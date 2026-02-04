using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Data;
using Backend.CSharp.Models;
using Backend.CSharp.Services;

namespace Backend.CSharp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PlayersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly ILogger<PlayersController> _logger;

    public PlayersController(AppDbContext context, HttpClient httpClient, ILogger<PlayersController> logger)
    {
        _context = context;
        _httpClient = httpClient;
        _logger = logger;
    }

    [HttpPost("sync")]
    public async Task<ActionResult<ApiResponse<object>>> SyncPlayers()
    {
        try
        {
            var sleeperPlayers = await SleeperService.GetAllPlayersStaticAsync(_httpClient);
            
            var count = 0;
            foreach (var kvp in sleeperPlayers)
            {
                var sleeperPlayer = kvp.Value;
                var player = await _context.Players
                    .FirstOrDefaultAsync(p => p.SleeperPlayerId == kvp.Key);

                if (player == null)
                {
                    player = new Player
                    {
                        SleeperPlayerId = kvp.Key,
                        FullName = sleeperPlayer.FullName,
                        FirstName = sleeperPlayer.FirstName,
                        LastName = sleeperPlayer.LastName,
                        Position = sleeperPlayer.Position,
                        Team = sleeperPlayer.Team,
                        Age = sleeperPlayer.Age,
                        YearsExp = sleeperPlayer.YearsExp,
                        College = sleeperPlayer.College,
                        Number = sleeperPlayer.Number,
                        Status = sleeperPlayer.Status,
                        SearchFullName = sleeperPlayer.FullName?.ToLower(),
                        SearchLastName = sleeperPlayer.LastName?.ToLower()
                    };
                    _context.Players.Add(player);
                }
                else
                {
                    player.FullName = sleeperPlayer.FullName;
                    player.FirstName = sleeperPlayer.FirstName;
                    player.LastName = sleeperPlayer.LastName;
                    player.Position = sleeperPlayer.Position;
                    player.Team = sleeperPlayer.Team;
                    player.Age = sleeperPlayer.Age;
                    player.YearsExp = sleeperPlayer.YearsExp;
                    player.College = sleeperPlayer.College;
                    player.Number = sleeperPlayer.Number;
                    player.Status = sleeperPlayer.Status;
                    player.SearchFullName = sleeperPlayer.FullName?.ToLower();
                    player.SearchLastName = sleeperPlayer.LastName?.ToLower();
                    player.UpdatedAt = DateTime.UtcNow;
                }
                
                count++;
                if (count % 1000 == 0)
                {
                    await _context.SaveChangesAsync();
                }
            }

            await _context.SaveChangesAsync();
            
            return Ok(new ApiResponse<object>
            {
                Status = "success",
                Data = new
                {
                    Message = $"Synced {count} players",
                    Count = count
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing players");
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to sync players"
            });
        }
    }

    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<Player>>>> Search(
        [FromQuery] string? q = null,
        [FromQuery] string? position = null,
        [FromQuery] int limit = 50)
    {
        try
        {
            var query = _context.Players.AsQueryable();

            if (!string.IsNullOrEmpty(q))
            {
                var searchTerm = q.ToLower();
                query = query.Where(p => 
                    p.SearchFullName!.Contains(searchTerm) || 
                    p.SearchLastName!.Contains(searchTerm));
            }

            if (!string.IsNullOrEmpty(position))
            {
                query = query.Where(p => p.Position == position);
            }

            var players = await query
                .OrderBy(p => p.FullName)
                .Take(limit)
                .ToListAsync();
            
            return Ok(new ApiResponse<List<Player>>
            {
                Status = "success",
                Data = players
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching players");
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to search players"
            });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Player>>> GetById(Guid id)
    {
        try
        {
            var player = await _context.Players.FindAsync(id);
            
            if (player == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Player not found"
                });
            }
            
            return Ok(new ApiResponse<Player>
            {
                Status = "success",
                Data = player
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching player {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch player"
            });
        }
    }

    [HttpGet("sleeper/{sleeperId}")]
    public async Task<ActionResult<ApiResponse<Player>>> GetBySleeperId(string sleeperId)
    {
        try
        {
            var player = await _context.Players
                .FirstOrDefaultAsync(p => p.SleeperPlayerId == sleeperId);
            
            if (player == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Player not found"
                });
            }
            
            return Ok(new ApiResponse<Player>
            {
                Status = "success",
                Data = player
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching player by Sleeper ID {SleeperId}", sleeperId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch player"
            });
        }
    }

    [HttpGet("{id}/contracts")]
    public async Task<ActionResult<ApiResponse<List<Contract>>>> GetPlayerContracts(Guid id)
    {
        try
        {
            var contracts = await _context.Contracts
                .Include(c => c.Team)
                .Include(c => c.League)
                .Where(c => c.PlayerId == id)
                .OrderByDescending(c => c.StartSeason)
                .ToListAsync();
            
            return Ok(new ApiResponse<List<Contract>>
            {
                Status = "success",
                Data = contracts
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching contracts for player {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch player contracts"
            });
        }
    }

    [HttpGet("position/{position}")]
    public async Task<ActionResult<ApiResponse<List<Player>>>> GetByPosition(string position)
    {
        try
        {
            var players = await _context.Players
                .Where(p => p.Position == position)
                .OrderBy(p => p.FullName)
                .ToListAsync();
            
            return Ok(new ApiResponse<List<Player>>
            {
                Status = "success",
                Data = players
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching players for position {Position}", position);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch players"
            });
        }
    }

    [HttpGet("league/{leagueId}/top-salaries")]
    public async Task<ActionResult<ApiResponse<object>>> GetTopSalaries(Guid leagueId, [FromQuery] int limit = 25)
    {
        try
        {
            var topContracts = await _context.Contracts
                .Include(c => c.Player)
                .Include(c => c.Team)
                .Where(c => c.LeagueId == leagueId && c.Status == "active")
                .OrderByDescending(c => c.Salary)
                .Take(limit)
                .Select(c => new
                {
                    c.Id,
                    c.Salary,
                    c.YearsRemaining,
                    Player = new
                    {
                        c.Player.Id,
                        c.Player.FullName,
                        c.Player.Position,
                        c.Player.Team
                    },
                    Team = new
                    {
                        c.Team!.Id,
                        c.Team.TeamName,
                        c.Team.OwnerName
                    }
                })
                .ToListAsync();
            
            return Ok(new ApiResponse<object>
            {
                Status = "success",
                Data = topContracts
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching top salaries for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch top salaries"
            });
        }
    }
}
