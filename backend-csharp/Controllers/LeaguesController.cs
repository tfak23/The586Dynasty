using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Data;
using Backend.CSharp.Models;

namespace Backend.CSharp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaguesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<LeaguesController> _logger;

    public LeaguesController(AppDbContext context, ILogger<LeaguesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<League>>>> GetAll()
    {
        try
        {
            var leagues = await _context.Leagues.OrderBy(l => l.Name).ToListAsync();
            
            return Ok(new ApiResponse<List<League>>
            {
                Status = "success",
                Data = leagues
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching leagues");
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch leagues"
            });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<League>>> GetById(Guid id)
    {
        try
        {
            var league = await _context.Leagues.FindAsync(id);
            
            if (league == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "League not found"
                });
            }
            
            return Ok(new ApiResponse<League>
            {
                Status = "success",
                Data = league
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching league {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch league"
            });
        }
    }

    [HttpGet("sleeper/{sleeperId}")]
    public async Task<ActionResult<ApiResponse<League>>> GetBySleeperId(string sleeperId)
    {
        try
        {
            var league = await _context.Leagues
                .FirstOrDefaultAsync(l => l.SleeperLeagueId == sleeperId);
            
            if (league == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "League not found"
                });
            }
            
            return Ok(new ApiResponse<League>
            {
                Status = "success",
                Data = league
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching league by Sleeper ID {SleeperId}", sleeperId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch league"
            });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<League>>> Create([FromBody] CreateLeagueRequest request)
    {
        try
        {
            var league = new League
            {
                SleeperLeagueId = request.SleeperLeagueId,
                Name = request.Name,
                SalaryCap = request.SalaryCap ?? 500.00m,
                MinContractYears = request.MinContractYears ?? 45,
                MaxContractYears = request.MaxContractYears ?? 75,
                TradeApprovalMode = request.TradeApprovalMode ?? "auto",
                LeagueVoteWindowHours = request.LeagueVoteWindowHours ?? 24,
                CurrentSeason = request.CurrentSeason ?? 2025
            };
            
            _context.Leagues.Add(league);
            await _context.SaveChangesAsync();
            
            return CreatedAtAction(nameof(GetById), new { id = league.Id }, new ApiResponse<League>
            {
                Status = "success",
                Data = league
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating league");
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to create league"
            });
        }
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<ApiResponse<League>>> Update(Guid id, [FromBody] UpdateLeagueRequest request)
    {
        try
        {
            var league = await _context.Leagues.FindAsync(id);
            
            if (league == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "League not found"
                });
            }
            
            if (request.Name != null) league.Name = request.Name;
            if (request.SalaryCap.HasValue) league.SalaryCap = request.SalaryCap.Value;
            if (request.MinContractYears.HasValue) league.MinContractYears = request.MinContractYears.Value;
            if (request.MaxContractYears.HasValue) league.MaxContractYears = request.MaxContractYears.Value;
            if (request.TradeApprovalMode != null) league.TradeApprovalMode = request.TradeApprovalMode;
            if (request.LeagueVoteWindowHours.HasValue) league.LeagueVoteWindowHours = request.LeagueVoteWindowHours.Value;
            if (request.VetoThreshold.HasValue) league.VetoThreshold = request.VetoThreshold.Value;
            if (request.CurrentSeason.HasValue) league.CurrentSeason = request.CurrentSeason.Value;
            
            league.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            return Ok(new ApiResponse<League>
            {
                Status = "success",
                Data = league
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating league {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to update league"
            });
        }
    }
}

public record CreateLeagueRequest(
    string SleeperLeagueId,
    string Name,
    decimal? SalaryCap = null,
    int? MinContractYears = null,
    int? MaxContractYears = null,
    string? TradeApprovalMode = null,
    int? LeagueVoteWindowHours = null,
    int? CurrentSeason = null
);

public record UpdateLeagueRequest(
    string? Name = null,
    decimal? SalaryCap = null,
    int? MinContractYears = null,
    int? MaxContractYears = null,
    string? TradeApprovalMode = null,
    int? LeagueVoteWindowHours = null,
    decimal? VetoThreshold = null,
    int? CurrentSeason = null
);
