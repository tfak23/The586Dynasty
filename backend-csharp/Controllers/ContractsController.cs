using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Data;
using Backend.CSharp.Models;

namespace Backend.CSharp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ContractsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<ContractsController> _logger;

    public ContractsController(AppDbContext context, ILogger<ContractsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("league/{leagueId}")]
    public async Task<ActionResult<ApiResponse<List<Contract>>>> GetByLeague(
        Guid leagueId,
        [FromQuery] string? status = null,
        [FromQuery] string? position = null,
        [FromQuery] Guid? teamId = null)
    {
        try
        {
            var query = _context.Contracts
                .Include(c => c.Player)
                .Include(c => c.Team)
                .Where(c => c.LeagueId == leagueId);

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(c => c.Status == status);
            }

            if (!string.IsNullOrEmpty(position))
            {
                query = query.Where(c => c.Player.Position == position);
            }

            if (teamId.HasValue)
            {
                query = query.Where(c => c.TeamId == teamId.Value);
            }

            var contracts = await query.OrderByDescending(c => c.Salary).ToListAsync();
            
            return Ok(new ApiResponse<List<Contract>>
            {
                Status = "success",
                Data = contracts
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching contracts for league {LeagueId}", leagueId);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch contracts"
            });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Contract>>> GetById(Guid id)
    {
        try
        {
            var contract = await _context.Contracts
                .Include(c => c.Player)
                .Include(c => c.Team)
                .FirstOrDefaultAsync(c => c.Id == id);
            
            if (contract == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Contract not found"
                });
            }
            
            return Ok(new ApiResponse<Contract>
            {
                Status = "success",
                Data = contract
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching contract {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to fetch contract"
            });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<Contract>>> Create([FromBody] CreateContractRequest request)
    {
        try
        {
            // Validate minimum salary
            if (request.Salary < 1)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Minimum salary is $1"
                });
            }

            // Check team cap room
            var team = await _context.Teams
                .Include(t => t.League)
                .FirstOrDefaultAsync(t => t.Id == request.TeamId);

            if (team == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Team not found"
                });
            }

            // Calculate current cap usage
            var currentContracts = await _context.Contracts
                .Where(c => c.TeamId == request.TeamId && c.Status == "active")
                .Where(c => c.StartSeason <= team.League.CurrentSeason && c.EndSeason >= team.League.CurrentSeason)
                .ToListAsync();

            var totalSalary = currentContracts.Sum(c => c.Salary);
            var capRoom = team.League.SalaryCap - totalSalary;

            if (request.Salary > capRoom)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Status = "error",
                    Message = $"Insufficient cap room. Available: ${capRoom:F2}"
                });
            }

            var contract = new Contract
            {
                LeagueId = request.LeagueId,
                TeamId = request.TeamId,
                PlayerId = request.PlayerId,
                Salary = request.Salary,
                YearsTotal = request.YearsTotal,
                YearsRemaining = request.YearsTotal,
                StartSeason = request.StartSeason,
                EndSeason = request.StartSeason + request.YearsTotal - 1,
                ContractType = request.ContractType ?? "standard",
                AcquisitionType = request.AcquisitionType ?? "free_agent",
                AcquisitionDate = DateTime.UtcNow,
                Status = "active",
                RosterStatus = "active"
            };
            
            _context.Contracts.Add(contract);
            await _context.SaveChangesAsync();
            
            // Log cap transaction
            var capTransaction = new CapTransaction
            {
                LeagueId = request.LeagueId,
                TeamId = request.TeamId,
                Season = team.League.CurrentSeason,
                TransactionType = "contract_signed",
                Amount = request.Salary,
                Description = $"Contract signed: {request.Salary:C}",
                RelatedContractId = contract.Id
            };
            _context.CapTransactions.Add(capTransaction);
            await _context.SaveChangesAsync();
            
            return CreatedAtAction(nameof(GetById), new { id = contract.Id }, new ApiResponse<Contract>
            {
                Status = "success",
                Data = contract
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating contract");
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to create contract"
            });
        }
    }

    [HttpPost("{id}/release")]
    public async Task<ActionResult<ApiResponse<object>>> Release(Guid id)
    {
        try
        {
            var contract = await _context.Contracts
                .Include(c => c.Team)
                    .ThenInclude(t => t!.League)
                .FirstOrDefaultAsync(c => c.Id == id);
            
            if (contract == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Contract not found"
                });
            }

            if (contract.Status != "active")
            {
                return BadRequest(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Contract is not active"
                });
            }

            // Calculate dead cap
            var deadCapHit = CalculateDeadCap(contract, contract.Team!.League.CurrentSeason);
            
            contract.Status = "released";
            contract.ReleasedAt = DateTime.UtcNow;
            contract.DeadCapHit = deadCapHit;
            contract.UpdatedAt = DateTime.UtcNow;

            // Log dead money transaction
            if (deadCapHit > 0)
            {
                var capTransaction = new CapTransaction
                {
                    LeagueId = contract.LeagueId,
                    TeamId = contract.TeamId ?? Guid.Empty,
                    Season = contract.Team!.League.CurrentSeason,
                    TransactionType = "dead_money",
                    Amount = deadCapHit,
                    Description = $"Dead cap from release",
                    RelatedContractId = contract.Id
                };
                _context.CapTransactions.Add(capTransaction);
            }

            await _context.SaveChangesAsync();
            
            return Ok(new ApiResponse<object>
            {
                Status = "success",
                Data = new
                {
                    Contract = contract,
                    DeadCapHit = deadCapHit
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error releasing contract {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to release contract"
            });
        }
    }

    [HttpGet("{id}/dead-cap-preview")]
    public async Task<ActionResult<ApiResponse<object>>> PreviewDeadCap(Guid id)
    {
        try
        {
            var contract = await _context.Contracts
                .Include(c => c.Team)
                    .ThenInclude(t => t!.League)
                .FirstOrDefaultAsync(c => c.Id == id);
            
            if (contract == null)
            {
                return NotFound(new ApiResponse<object>
                {
                    Status = "error",
                    Message = "Contract not found"
                });
            }

            var deadCapHit = CalculateDeadCap(contract, contract.Team!.League.CurrentSeason);
            
            return Ok(new ApiResponse<object>
            {
                Status = "success",
                Data = new
                {
                    DeadCapHit = deadCapHit,
                    CurrentSalary = contract.Salary,
                    YearsRemaining = contract.YearsRemaining
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error previewing dead cap for contract {Id}", id);
            return StatusCode(500, new ApiResponse<object>
            {
                Status = "error",
                Message = "Failed to calculate dead cap preview"
            });
        }
    }

    private decimal CalculateDeadCap(Contract contract, int releaseSeason)
    {
        // $1 contracts always retain full cap hit
        if (contract.Salary <= 1)
        {
            return contract.Salary;
        }

        var yearsIntoContract = releaseSeason - contract.StartSeason + 1;
        
        // Dead cap percentages by contract length and current year
        var deadCapPct = contract.YearsTotal switch
        {
            5 => yearsIntoContract switch
            {
                1 => 0.75m,
                2 => 0.50m,
                3 => 0.25m,
                4 => 0.10m,
                5 => 0.10m,
                _ => 0m
            },
            4 => yearsIntoContract switch
            {
                1 => 0.75m,
                2 => 0.50m,
                3 => 0.25m,
                4 => 0.10m,
                _ => 0m
            },
            3 => yearsIntoContract switch
            {
                1 => 0.50m,
                2 => 0.25m,
                3 => 0.10m,
                _ => 0m
            },
            2 => yearsIntoContract switch
            {
                1 => 0.50m,
                2 => 0.25m,
                _ => 0m
            },
            1 => yearsIntoContract switch
            {
                1 => 0.50m,
                _ => 0m
            },
            _ => 0m
        };

        return Math.Round(contract.Salary * deadCapPct, 2);
    }
}

public record CreateContractRequest(
    Guid LeagueId,
    Guid TeamId,
    Guid PlayerId,
    decimal Salary,
    int YearsTotal,
    int StartSeason,
    string? ContractType = null,
    string? AcquisitionType = null
);
