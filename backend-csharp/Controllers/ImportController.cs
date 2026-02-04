using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Data;
using Backend.CSharp.Models;
using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using System.Text;

namespace Backend.CSharp.Controllers;

/// <summary>
/// Controller for importing league data from CSV
/// </summary>
[ApiController]
[Route("api/import")]
public class ImportController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<ImportController> _logger;

    private const int CURRENT_SEASON = 2026;

    private static readonly Dictionary<string, string> OwnerNameMap = new()
    {
        { "Brian", "brcarnag" },
        { "Mike", "miket1326" },
        { "Dom", "DomDuhBomb" },
        { "Willie", "bigwily57" },
        { "Tony", "TonyFF" },
        { "Garett", "Gazarato" },
        { "Cang", "CanThePan" },
        { "Trevor", "TrevorH42" },
        { "Abhi", "abhanot11" },
        { "Nick", "NickDnof" },
        { "Zach", "zachg1313" },
        { "Kyle", "Klucido08" }
    };

    public ImportController(AppDbContext context, ILogger<ImportController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Import CSV data
    /// </summary>
    [HttpPost("csv/{leagueId}")]
    public async Task<ActionResult<ApiResponse<ImportResult>>> ImportCsv(
        Guid leagueId,
        [FromBody] CsvImportRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.CsvData))
            {
                return BadRequest(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "csvData is required"
                });
            }

            var league = await _context.Leagues.FindAsync(leagueId);
            if (league == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "League not found"
                });
            }

            var result = new ImportResult
            {
                PlayersImported = 0,
                ContractsCreated = 0,
                ExpiredContracts = 0,
                Errors = new List<string>(),
                Warnings = new List<string>()
            };

            // Parse CSV
            var records = ParseCsv(request.CsvData);

            _logger.LogInformation("Processing {Count} rows...", records.Count);

            var rowNum = 2; // Start at 2 for header + 0-index
            foreach (var row in records)
            {
                try
                {
                    var parsed = ParseCsvRow(row);
                    if (parsed == null)
                    {
                        rowNum++;
                        continue;
                    }

                    // Find player
                    var player = await FindPlayerByNameAsync(parsed.PlayerName, parsed.Position);
                    if (player == null)
                    {
                        result.Warnings.Add($"Row {rowNum}: Could not match player \"{parsed.PlayerName}\" ({parsed.Position})");
                        rowNum++;
                        continue;
                    }

                    // Find team
                    var team = await FindTeamByOwnerAsync(leagueId, parsed.Owner);
                    if (team == null)
                    {
                        result.Warnings.Add($"Row {rowNum}: Could not match owner \"{parsed.Owner}\"");
                        rowNum++;
                        continue;
                    }

                    if (!request.DryRun)
                    {
                        if (parsed.ContractStatus == "active" && parsed.Salary.HasValue)
                        {
                            // Calculate contract years
                            var yearsTotal = parsed.YearsRemaining > 0 ? parsed.YearsRemaining : 1;
                            var startSeason = parsed.EndSeason - yearsTotal + 1;

                            // Create active contract
                            var existingContract = await _context.Contracts
                                .FirstOrDefaultAsync(c => c.LeagueId == leagueId &&
                                                         c.TeamId == team.Id &&
                                                         c.PlayerId == player.Id &&
                                                         c.Status == "active");

                            if (existingContract == null)
                            {
                                _context.Contracts.Add(new Contract
                                {
                                    LeagueId = leagueId,
                                    TeamId = team.Id,
                                    PlayerId = player.Id,
                                    Salary = parsed.Salary.Value,
                                    YearsTotal = yearsTotal,
                                    YearsRemaining = parsed.YearsRemaining,
                                    StartSeason = startSeason,
                                    EndSeason = parsed.EndSeason,
                                    ContractType = parsed.IsRookie ? "rookie" :
                                                  (parsed.IsFranchiseTagged ? "tag" : "standard"),
                                    HasOption = parsed.HasOption,
                                    OptionYear = parsed.OptionYear,
                                    IsFranchiseTagged = parsed.IsFranchiseTagged,
                                    RosterStatus = parsed.RosterStatus,
                                    AcquisitionType = "import",
                                    AcquisitionDate = DateTime.UtcNow.Date,
                                    AcquisitionDetailsJson = System.Text.Json.JsonSerializer.Serialize(new
                                    {
                                        source = "csv_import",
                                        importedAt = DateTime.UtcNow,
                                        yearValues = parsed.YearValues
                                    }),
                                    Status = "active"
                                });
                                result.ContractsCreated++;
                            }
                        }
                        else
                        {
                            // Create expired contract record
                            var existingExpired = await _context.ExpiredContracts
                                .FirstOrDefaultAsync(ec => ec.LeagueId == leagueId &&
                                                          ec.TeamId == team.Id &&
                                                          ec.PlayerId == player.Id &&
                                                          ec.Season == CURRENT_SEASON);

                            if (existingExpired == null)
                            {
                                _context.ExpiredContracts.Add(new ExpiredContract
                                {
                                    LeagueId = leagueId,
                                    TeamId = team.Id,
                                    PlayerId = player.Id,
                                    RosterStatus = parsed.RosterStatus,
                                    Season = CURRENT_SEASON,
                                    EligibleForFranchiseTag = true
                                });
                                result.ExpiredContracts++;
                            }
                        }
                    }

                    result.PlayersImported++;
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"Row {rowNum}: {ex.Message}");
                }

                rowNum++;
            }

            if (!request.DryRun)
            {
                await _context.SaveChangesAsync();
            }

            return Ok(new ApiResponse<ImportResult>
            {
                Status = "success",
                Data = result,
                Message = request.DryRun
                    ? "Dry run completed. No changes were made."
                    : "Import completed successfully."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error importing CSV for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to import CSV"
            });
        }
    }

    private List<CsvRow> ParseCsv(string csvData)
    {
        using var reader = new StringReader(csvData);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            TrimOptions = TrimOptions.Trim
        });

        return csv.GetRecords<CsvRow>().ToList();
    }

    private ParsedContract? ParseCsvRow(CsvRow row)
    {
        if (string.IsNullOrEmpty(row.Player) || string.IsNullOrEmpty(row.Owner))
        {
            return null;
        }

        var playerName = row.Player;
        var isRookie = playerName.Contains(",RK,");
        var isFranchiseTagged = playerName.Contains(",TAG,");

        playerName = playerName
            .Replace(",RK,", " ")
            .Replace(",TAG,", " ")
            .Replace("  ", " ")
            .Trim();

        // Parse year columns
        var yearColumns = new[] { "2026", "2027", "2028", "2029", "2030" };
        var yearValues = new List<string?>();

        foreach (var year in yearColumns)
        {
            var value = GetCsvValue(row, year);
            yearValues.Add(value);
        }

        var optionIndex = yearValues.IndexOf("OPT");
        var hasOption = optionIndex != -1;
        var optionYear = hasOption ? 2026 + optionIndex : (int?)null;

        var activeYears = yearValues.Count(v => !string.IsNullOrEmpty(v) && v != "OPT");

        var endSeason = CURRENT_SEASON;
        for (int i = yearValues.Count - 1; i >= 0; i--)
        {
            if (!string.IsNullOrEmpty(yearValues[i]) && yearValues[i] != "OPT")
            {
                endSeason = 2026 + i;
                break;
            }
        }

        var salaryStr = row.CON?.Trim();
        decimal? salary = null;
        if (!string.IsNullOrEmpty(salaryStr))
        {
            if (decimal.TryParse(salaryStr.Replace("$", ""), out var parsedSalary))
            {
                salary = parsedSalary;
            }
        }

        return new ParsedContract
        {
            PlayerName = playerName,
            Position = row.POS?.Trim() ?? "",
            Owner = row.Owner?.Trim() ?? "",
            Salary = salary,
            YearsRemaining = activeYears,
            EndSeason = endSeason,
            HasOption = hasOption,
            OptionYear = optionYear,
            IsRookie = isRookie,
            IsFranchiseTagged = isFranchiseTagged,
            RosterStatus = row.RosterStatus?.ToLower() == "ir" ? "ir" : "active",
            ContractStatus = salary.HasValue && salary > 0 ? "active" : "expired",
            YearValues = yearValues
        };
    }

    private string? GetCsvValue(CsvRow row, string year)
    {
        var value = year switch
        {
            "2026" => row.Year2026,
            "2027" => row.Year2027,
            "2028" => row.Year2028,
            "2029" => row.Year2029,
            "2030" => row.Year2030,
            _ => null
        };

        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private async Task<Player?> FindPlayerByNameAsync(string name, string position)
    {
        var searchName = name.ToLower();

        // Try exact match first
        var player = await _context.Players
            .FirstOrDefaultAsync(p => p.SearchFullName == searchName && p.Position == position);

        if (player != null) return player;

        // Try fuzzy match by last name
        var nameParts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (nameParts.Length >= 2)
        {
            var lastName = nameParts[^1].ToLower();
            player = await _context.Players
                .FirstOrDefaultAsync(p => p.SearchLastName == lastName && p.Position == position);
        }

        return player;
    }

    private async Task<Team?> FindTeamByOwnerAsync(Guid leagueId, string ownerName)
    {
        // Try mapped name
        if (OwnerNameMap.TryGetValue(ownerName, out var mappedUsername))
        {
            var team = await _context.Teams
                .FirstOrDefaultAsync(t => t.LeagueId == leagueId &&
                                         !string.IsNullOrEmpty(t.OwnerName) &&
                                         t.OwnerName.ToLower() == mappedUsername.ToLower());
            if (team != null) return team;
        }

        // Try direct owner name match
        return await _context.Teams
            .FirstOrDefaultAsync(t => t.LeagueId == leagueId &&
                                     !string.IsNullOrEmpty(t.OwnerName) &&
                                     t.OwnerName.ToLower().Contains(ownerName.ToLower()));
    }
}

public class CsvImportRequest
{
    public string CsvData { get; set; } = string.Empty;
    public bool DryRun { get; set; } = false;
}

public class CsvRow
{
    public string? Player { get; set; }
    public string? POS { get; set; }
    public string? Owner { get; set; }
    public string? CON { get; set; }
    public string? Year2026 { get; set; }
    public string? Year2027 { get; set; }
    public string? Year2028 { get; set; }
    public string? Year2029 { get; set; }
    public string? Year2030 { get; set; }
    public string? RosterStatus { get; set; }
}

public class ParsedContract
{
    public string PlayerName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public decimal? Salary { get; set; }
    public int YearsRemaining { get; set; }
    public int EndSeason { get; set; }
    public bool HasOption { get; set; }
    public int? OptionYear { get; set; }
    public bool IsRookie { get; set; }
    public bool IsFranchiseTagged { get; set; }
    public string RosterStatus { get; set; } = "active";
    public string ContractStatus { get; set; } = string.Empty;
    public List<string?> YearValues { get; set; } = new();
}
