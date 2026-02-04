using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Data;
using Backend.CSharp.Models;

namespace Backend.CSharp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<TeamsController> _logger;

    public TeamsController(AppDbContext context, ILogger<TeamsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("league/{leagueId}")]
    public async Task<ActionResult<ApiResponse<List<Team>>>> GetTeamsByLeague(Guid leagueId)
    {
        try
        {
            var teams = await _context.Teams
                .Where(t => t.LeagueId == leagueId)
                .OrderBy(t => t.TeamName)
                .ToListAsync();
            
            return Ok(new ApiResponse<List<Team>>
            {
                Status = "success",
                Data = teams
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching teams for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch teams"
            });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Team>>> GetById(Guid id)
    {
        try
        {
            var team = await _context.Teams.FindAsync(id);
            
            if (team == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Team not found"
                });
            }
            
            return Ok(new ApiResponse<Team>
            {
                Status = "success",
                Data = team
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching team {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch team"
            });
        }
    }

    [HttpGet("{id}/cap")]
    public async Task<ActionResult<ApiResponse<TeamCapSummary>>> GetTeamCap(Guid id)
    {
        try
        {
            var team = await _context.Teams
                .Include(t => t.League)
                .FirstOrDefaultAsync(t => t.Id == id);
            
            if (team == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Team not found"
                });
            }

            // Calculate cap summary
            var contracts = await _context.Contracts
                .Where(c => c.TeamId == id && c.Status == "active")
                .Where(c => c.StartSeason <= team.League.CurrentSeason && c.EndSeason >= team.League.CurrentSeason)
                .ToListAsync();

            var totalSalary = contracts.Sum(c => c.Salary);
            var totalContractYears = contracts.Sum(c => c.YearsRemaining);

            // Get dead money from cap transactions
            var deadMoney = await _context.CapTransactions
                .Where(ct => ct.TeamId == id && ct.Season == team.League.CurrentSeason && ct.TransactionType == "dead_money")
                .SumAsync(ct => ct.Amount);

            // Get cap adjustments
            var capAdjustments = await _context.CapAdjustments
                .Where(ca => ca.TeamId == id)
                .ToListAsync();

            var adjustmentAmount = capAdjustments.Sum(ca => team.League.CurrentSeason switch
            {
                2026 => ca.Amount2026,
                2027 => ca.Amount2027,
                2028 => ca.Amount2028,
                2029 => ca.Amount2029,
                2030 => ca.Amount2030,
                _ => 0
            });

            var summary = new TeamCapSummary
            {
                TeamId = team.Id,
                TeamName = team.TeamName ?? "",
                OwnerName = team.OwnerName ?? "",
                SalaryCap = team.League.SalaryCap,
                CurrentSeason = team.League.CurrentSeason,
                TotalSalary = totalSalary,
                ActiveContracts = contracts.Count,
                TotalContractYears = totalContractYears,
                DeadMoney = deadMoney + adjustmentAmount,
                CapRoom = team.League.SalaryCap - totalSalary - deadMoney - adjustmentAmount
            };
            
            return Ok(new ApiResponse<TeamCapSummary>
            {
                Status = "success",
                Data = summary
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating cap for team {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to calculate team cap"
            });
        }
    }

    [HttpGet("league/{leagueId}/cap")]
    public async Task<ActionResult<ApiResponse<List<TeamCapSummary>>>> GetLeagueCap(Guid leagueId)
    {
        try
        {
            var league = await _context.Leagues.FindAsync(leagueId);
            if (league == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "League not found"
                });
            }

            var teams = await _context.Teams
                .Where(t => t.LeagueId == leagueId)
                .ToListAsync();

            var summaries = new List<TeamCapSummary>();

            foreach (var team in teams)
            {
                var contracts = await _context.Contracts
                    .Where(c => c.TeamId == team.Id && c.Status == "active")
                    .Where(c => c.StartSeason <= league.CurrentSeason && c.EndSeason >= league.CurrentSeason)
                    .ToListAsync();

                var totalSalary = contracts.Sum(c => c.Salary);
                var deadMoney = await _context.CapTransactions
                    .Where(ct => ct.TeamId == team.Id && ct.Season == league.CurrentSeason && ct.TransactionType == "dead_money")
                    .SumAsync(ct => ct.Amount);

                var capAdjustments = await _context.CapAdjustments
                    .Where(ca => ca.TeamId == team.Id)
                    .ToListAsync();

                var adjustmentAmount = capAdjustments.Sum(ca => league.CurrentSeason switch
                {
                    2026 => ca.Amount2026,
                    2027 => ca.Amount2027,
                    2028 => ca.Amount2028,
                    2029 => ca.Amount2029,
                    2030 => ca.Amount2030,
                    _ => 0
                });

                summaries.Add(new TeamCapSummary
                {
                    TeamId = team.Id,
                    TeamName = team.TeamName ?? "",
                    OwnerName = team.OwnerName ?? "",
                    SalaryCap = league.SalaryCap,
                    CurrentSeason = league.CurrentSeason,
                    TotalSalary = totalSalary,
                    ActiveContracts = contracts.Count,
                    TotalContractYears = contracts.Sum(c => c.YearsRemaining),
                    DeadMoney = deadMoney + adjustmentAmount,
                    CapRoom = league.SalaryCap - totalSalary - deadMoney - adjustmentAmount
                });
            }
            
            return Ok(new ApiResponse<List<TeamCapSummary>>
            {
                Status = "success",
                Data = summaries
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating caps for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to calculate league caps"
            });
        }
    }

    [HttpGet("{id}/roster")]
    public async Task<ActionResult<ApiResponse<object>>> GetRoster(Guid id)
    {
        try
        {
            var team = await _context.Teams
                .Include(t => t.League)
                .FirstOrDefaultAsync(t => t.Id == id);
            
            if (team == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Team not found"
                });
            }

            var contracts = await _context.Contracts
                .Include(c => c.Player)
                .Where(c => c.TeamId == id && c.Status == "active")
                .OrderByDescending(c => c.Salary)
                .Select(c => new
                {
                    c.Id,
                    c.Salary,
                    c.YearsRemaining,
                    c.StartSeason,
                    c.EndSeason,
                    c.ContractType,
                    c.RosterStatus,
                    Player = new
                    {
                        c.Player.Id,
                        c.Player.FullName,
                        c.Player.Position,
                        c.Player.Team,
                        c.Player.Age
                    }
                })
                .ToListAsync();
            
            return Ok(new ApiResponse<object>
            {
                Status = "success",
                Data = new
                {
                    Team = team,
                    Contracts = contracts
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching roster for team {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch roster"
            });
        }
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<ApiResponse<Team>>> Update(Guid id, [FromBody] UpdateTeamRequest request)
    {
        try
        {
            var team = await _context.Teams.FindAsync(id);
            
            if (team == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Team not found"
                });
            }
            
            if (request.TeamName != null) team.TeamName = request.TeamName;
            if (request.OwnerName != null) team.OwnerName = request.OwnerName;
            if (request.AvatarUrl != null) team.AvatarUrl = request.AvatarUrl;
            if (request.Division != null) team.Division = request.Division;
            
            team.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            return Ok(new ApiResponse<Team>
            {
                Status = "success",
                Data = team
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to update team"
            });
        }
    }
}

public record UpdateTeamRequest(
    string? TeamName = null,
    string? OwnerName = null,
    string? AvatarUrl = null,
    string? Division = null
);
