namespace Backend.CSharp.Models;

public class ApiResponse<T>
{
    public string Status { get; set; } = "success";
    public T? Data { get; set; }
    public string? Message { get; set; }
    public ResponseMeta? Meta { get; set; }
}

public class ResponseMeta
{
    public int? Total { get; set; }
    public int? Page { get; set; }
    public int? Limit { get; set; }
}

public class TeamCapSummary
{
    public Guid TeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public decimal SalaryCap { get; set; }
    public int CurrentSeason { get; set; }
    public decimal TotalSalary { get; set; }
    public int ActiveContracts { get; set; }
    public int TotalContractYears { get; set; }
    public decimal DeadMoney { get; set; }
    public decimal CapRoom { get; set; }
}

public class TeamContractYears
{
    public Guid TeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public int MinContractYears { get; set; }
    public int MaxContractYears { get; set; }
    public int TotalYears { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class ContractEvaluation
{
    public Guid ContractId { get; set; }
    public string PlayerName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public decimal Salary { get; set; }
    public decimal AverageSalary { get; set; }
    public decimal? PointsPerGame { get; set; }
    public decimal ValueScore { get; set; }
    public string Rating { get; set; } = string.Empty;
    public int Rank { get; set; }
    public string? Reasoning { get; set; }
}

public class ContractEstimate
{
    public decimal EstimatedSalary { get; set; }
    public decimal SalaryRangeMin { get; set; }
    public decimal SalaryRangeMax { get; set; }
    public string Confidence { get; set; } = string.Empty;
    public List<ComparablePlayer> ComparablePlayers { get; set; } = new();
    public string Reasoning { get; set; } = string.Empty;
}

public class ComparablePlayer
{
    public string PlayerName { get; set; } = string.Empty;
    public decimal Salary { get; set; }
    public decimal? PointsPerGame { get; set; }
    public int? Age { get; set; }
}

public class ImportResult
{
    public int PlayersImported { get; set; }
    public int ContractsCreated { get; set; }
    public int ExpiredContracts { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public class SyncResult
{
    public string Status { get; set; } = string.Empty;
    public int RecordsProcessed { get; set; }
    public List<string> Errors { get; set; } = new();
    public DateTime? LastSyncTime { get; set; }
}

// Sleeper API DTOs
public class SleeperLeague
{
    public string LeagueId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int TotalRosters { get; set; }
    public List<string>? RosterPositions { get; set; }
    public Dictionary<string, decimal>? ScoringSettings { get; set; }
    public string Season { get; set; } = string.Empty;
}

public class SleeperUser
{
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Avatar { get; set; }
}

public class SleeperRoster
{
    public int RosterId { get; set; }
    public string? OwnerId { get; set; }
    public List<string> Players { get; set; } = new();
    public List<string>? Taxi { get; set; }
    public List<string>? Reserve { get; set; }
}

public class SleeperPlayer
{
    public string PlayerId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string Position { get; set; } = string.Empty;
    public string? Team { get; set; }
    public int? Age { get; set; }
    public int? YearsExp { get; set; }
    public string? College { get; set; }
    public int? Number { get; set; }
    public string? Status { get; set; }
}
