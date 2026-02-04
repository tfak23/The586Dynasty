using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Data;
using Backend.CSharp.Models;

namespace Backend.CSharp.Controllers;

/// <summary>
/// Controller for managing trade history archives
/// </summary>
[ApiController]
[Route("api/trade-history")]
public class TradeHistoryController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<TradeHistoryController> _logger;

    public TradeHistoryController(AppDbContext context, ILogger<TradeHistoryController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get trade history for a league with optional filters
    /// </summary>
    [HttpGet("league/{leagueId}")]
    public async Task<ActionResult<ApiResponse<List<TradeHistory>>>> GetLeagueTradeHistory(
        Guid leagueId,
        [FromQuery] int? year = null,
        [FromQuery] Guid? teamId = null,
        [FromQuery] string? teamName = null)
    {
        try
        {
            var query = _context.TradeHistories
                .Where(th => th.LeagueId == leagueId);

            if (year.HasValue)
            {
                query = query.Where(th => th.TradeYear == year.Value);
            }

            if (teamId.HasValue)
            {
                query = query.Where(th => th.Team1Id == teamId.Value || th.Team2Id == teamId.Value);
            }

            if (!string.IsNullOrEmpty(teamName))
            {
                var searchTerm = teamName.ToLower();
                query = query.Where(th =>
                    th.Team1Name.ToLower().Contains(searchTerm) ||
                    th.Team2Name.ToLower().Contains(searchTerm));
            }

            var trades = await query
                .OrderByDescending(th => th.TradeYear)
                .ThenByDescending(th => th.TradeNumber)
                .ToListAsync();

            return Ok(new ApiResponse<List<TradeHistory>>
            {
                Status = "success",
                Data = trades
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trade history for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch trade history"
            });
        }
    }

    /// <summary>
    /// Get available years for filtering
    /// </summary>
    [HttpGet("league/{leagueId}/years")]
    public async Task<ActionResult<ApiResponse<List<int>>>> GetAvailableYears(Guid leagueId)
    {
        try
        {
            var years = await _context.TradeHistories
                .Where(th => th.LeagueId == leagueId)
                .Select(th => th.TradeYear)
                .Distinct()
                .OrderByDescending(y => y)
                .ToListAsync();

            return Ok(new ApiResponse<List<int>>
            {
                Status = "success",
                Data = years
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trade years for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch trade years"
            });
        }
    }

    /// <summary>
    /// Get all unique team names involved in trades
    /// </summary>
    [HttpGet("league/{leagueId}/teams")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetTeamNames(Guid leagueId)
    {
        try
        {
            var team1Names = _context.TradeHistories
                .Where(th => th.LeagueId == leagueId)
                .Select(th => th.Team1Name);

            var team2Names = _context.TradeHistories
                .Where(th => th.LeagueId == leagueId)
                .Select(th => th.Team2Name);

            var allNames = await team1Names
                .Union(team2Names)
                .Distinct()
                .OrderBy(n => n)
                .ToListAsync();

            return Ok(new ApiResponse<List<string>>
            {
                Status = "success",
                Data = allNames
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching team names for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch team names"
            });
        }
    }

    /// <summary>
    /// Get trade by number
    /// </summary>
    [HttpGet("league/{leagueId}/{tradeNumber}")]
    public async Task<ActionResult<ApiResponse<TradeHistory>>> GetTradeByNumber(
        Guid leagueId,
        string tradeNumber)
    {
        try
        {
            var trade = await _context.TradeHistories
                .FirstOrDefaultAsync(th =>
                    th.LeagueId == leagueId &&
                    th.TradeNumber == tradeNumber);

            if (trade == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Trade not found"
                });
            }

            return Ok(new ApiResponse<TradeHistory>
            {
                Status = "success",
                Data = trade
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trade {TradeNumber} for league {LeagueId}",
                tradeNumber, leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch trade"
            });
        }
    }

    /// <summary>
    /// Get all cap adjustments for a league
    /// </summary>
    [HttpGet("league/{leagueId}/cap-adjustments")]
    public async Task<ActionResult<ApiResponse<object>>> GetCapAdjustments(Guid leagueId)
    {
        try
        {
            var adjustments = await _context.CapAdjustments
                .Include(ca => ca.Team)
                .Where(ca => ca.LeagueId == leagueId)
                .OrderBy(ca => ca.Team.TeamName)
                .ThenByDescending(ca => ca.CreatedAt)
                .Select(ca => new
                {
                    ca.Id,
                    ca.TeamId,
                    TeamName = ca.Team.TeamName,
                    OwnerName = ca.Team.OwnerName,
                    ca.AdjustmentType,
                    ca.Description,
                    ca.PlayerName,
                    ca.Amount2026,
                    ca.Amount2027,
                    ca.Amount2028,
                    ca.Amount2029,
                    ca.Amount2030,
                    ca.CreatedAt,
                    ca.Notes
                })
                .ToListAsync();

            return Ok(new ApiResponse<object>
            {
                Status = "success",
                Data = adjustments
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching cap adjustments for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch cap adjustments"
            });
        }
    }
}
