using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Data;
using Backend.CSharp.Models;

namespace Backend.CSharp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TradesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<TradesController> _logger;

    public TradesController(AppDbContext context, ILogger<TradesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("league/{leagueId}")]
    public async Task<ActionResult<ApiResponse<List<Trade>>>> GetByLeague(
        Guid leagueId,
        [FromQuery] string? status = null,
        [FromQuery] Guid? teamId = null)
    {
        try
        {
            var query = _context.Trades
                .Include(t => t.TradeTeams)
                    .ThenInclude(tt => tt.Team)
                .Include(t => t.TradeAssets)
                .Where(t => t.LeagueId == leagueId);

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(t => t.Status == status);
            }

            if (teamId.HasValue)
            {
                query = query.Where(t => t.TradeTeams.Any(tt => tt.TeamId == teamId.Value));
            }

            var trades = await query
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();
            
            return Ok(new ApiResponse<List<Trade>>
            {
                Status = "success",
                Data = trades
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trades for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch trades"
            });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Trade>>> GetById(Guid id)
    {
        try
        {
            var trade = await _context.Trades
                .Include(t => t.TradeTeams)
                    .ThenInclude(tt => tt.Team)
                .Include(t => t.TradeAssets)
                    .ThenInclude(ta => ta.Contract)
                        .ThenInclude(c => c!.Player)
                .Include(t => t.TradeAssets)
                    .ThenInclude(ta => ta.DraftPick)
                .Include(t => t.TradeVotes)
                    .ThenInclude(tv => tv.Team)
                .FirstOrDefaultAsync(t => t.Id == id);
            
            if (trade == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Trade not found"
                });
            }
            
            return Ok(new ApiResponse<Trade>
            {
                Status = "success",
                Data = trade
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching trade {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch trade"
            });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<Trade>>> Create([FromBody] CreateTradeRequest request)
    {
        try
        {
            var league = await _context.Leagues.FindAsync(request.LeagueId);
            if (league == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "League not found"
                });
            }

            // Create trade
            var trade = new Trade
            {
                LeagueId = request.LeagueId,
                Status = "pending",
                ApprovalMode = league.TradeApprovalMode,
                RequiresCommissionerApproval = league.TradeApprovalMode == "commissioner",
                RequiresLeagueVote = league.TradeApprovalMode == "league_vote",
                ExpiresAt = DateTime.UtcNow.AddHours(48),
                ProposerTeamId = request.ProposerTeamId,
                Notes = request.Notes
            };

            if (league.TradeApprovalMode == "league_vote")
            {
                trade.VoteDeadline = DateTime.UtcNow.AddHours(league.LeagueVoteWindowHours ?? 24);
            }

            _context.Trades.Add(trade);
            await _context.SaveChangesAsync();

            // Add participating teams
            foreach (var teamId in request.TeamIds)
            {
                var tradeTeam = new TradeTeam
                {
                    TradeId = trade.Id,
                    TeamId = teamId,
                    Status = teamId == request.ProposerTeamId ? "accepted" : "pending"
                };
                _context.TradeTeams.Add(tradeTeam);
            }

            // Add assets
            foreach (var asset in request.Assets)
            {
                var tradeAsset = new TradeAsset
                {
                    TradeId = trade.Id,
                    FromTeamId = asset.FromTeamId,
                    ToTeamId = asset.ToTeamId,
                    AssetType = asset.AssetType,
                    ContractId = asset.ContractId,
                    DraftPickId = asset.DraftPickId,
                    CapAmount = asset.CapAmount,
                    CapYear = asset.CapYear
                };
                _context.TradeAssets.Add(tradeAsset);
            }

            await _context.SaveChangesAsync();
            
            return CreatedAtAction(nameof(GetById), new { id = trade.Id }, new ApiResponse<Trade>
            {
                Status = "success",
                Data = trade
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating trade");
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to create trade"
            });
        }
    }

    [HttpPost("{id}/accept")]
    public async Task<ActionResult<ApiResponse<Trade>>> Accept(Guid id, [FromBody] AcceptTradeRequest request)
    {
        try
        {
            var trade = await _context.Trades
                .Include(t => t.TradeTeams)
                .FirstOrDefaultAsync(t => t.Id == id);
            
            if (trade == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Trade not found"
                });
            }

            if (trade.Status != "pending")
            {
                return BadRequest(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Trade is not pending"
                });
            }

            var tradeTeam = trade.TradeTeams.FirstOrDefault(tt => tt.TeamId == request.TeamId);
            if (tradeTeam == null)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Team is not part of this trade"
                });
            }

            tradeTeam.Status = "accepted";
            tradeTeam.AcceptedAt = DateTime.UtcNow;

            // Check if all teams have accepted
            var allAccepted = trade.TradeTeams.All(tt => tt.Status == "accepted");
            
            if (allAccepted)
            {
                if (trade.ApprovalMode == "auto")
                {
                    trade.Status = "completed";
                    await ExecuteTrade(trade);
                }
                else
                {
                    trade.Status = "accepted";
                }
            }

            trade.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            return Ok(new ApiResponse<Trade>
            {
                Status = "success",
                Data = trade
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error accepting trade {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to accept trade"
            });
        }
    }

    private async Task ExecuteTrade(Trade trade)
    {
        // Load assets
        var assets = await _context.TradeAssets
            .Where(ta => ta.TradeId == trade.Id)
            .Include(ta => ta.Contract)
            .Include(ta => ta.DraftPick)
            .ToListAsync();

        // Transfer contracts
        foreach (var asset in assets.Where(a => a.AssetType == "contract" && a.ContractId.HasValue))
        {
            var contract = asset.Contract;
            if (contract != null)
            {
                contract.TeamId = asset.ToTeamId;
                contract.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Transfer draft picks
        foreach (var asset in assets.Where(a => a.AssetType == "draft_pick" && a.DraftPickId.HasValue))
        {
            var pick = asset.DraftPick;
            if (pick != null)
            {
                pick.CurrentTeamId = asset.ToTeamId;
                pick.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();
    }
}

public record CreateTradeRequest(
    Guid LeagueId,
    Guid ProposerTeamId,
    List<Guid> TeamIds,
    List<TradeAssetRequest> Assets,
    string? Notes = null
);

public record TradeAssetRequest(
    Guid FromTeamId,
    Guid ToTeamId,
    string AssetType,
    Guid? ContractId = null,
    Guid? DraftPickId = null,
    decimal? CapAmount = null,
    int? CapYear = null
);

public record AcceptTradeRequest(
    Guid TeamId
);
