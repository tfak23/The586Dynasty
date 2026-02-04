using Microsoft.EntityFrameworkCore;
using Backend.CSharp.Models;

namespace Backend.CSharp.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<League> Leagues { get; set; }
    public DbSet<Team> Teams { get; set; }
    public DbSet<Player> Players { get; set; }
    public DbSet<Contract> Contracts { get; set; }
    public DbSet<Trade> Trades { get; set; }
    public DbSet<TradeTeam> TradeTeams { get; set; }
    public DbSet<TradeAsset> TradeAssets { get; set; }
    public DbSet<TradeVote> TradeVotes { get; set; }
    public DbSet<DraftPick> DraftPicks { get; set; }
    public DbSet<CapAdjustment> CapAdjustments { get; set; }
    public DbSet<TradeHistory> TradeHistories { get; set; }
    public DbSet<CapTransaction> CapTransactions { get; set; }
    public DbSet<ExpiredContract> ExpiredContracts { get; set; }
    public DbSet<SyncLog> SyncLogs { get; set; }
    public DbSet<PlayerSeasonStat> PlayerSeasonStats { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure unique constraints
        modelBuilder.Entity<League>()
            .HasIndex(l => l.SleeperLeagueId)
            .IsUnique();

        modelBuilder.Entity<Player>()
            .HasIndex(p => p.SleeperPlayerId)
            .IsUnique();

        modelBuilder.Entity<Team>()
            .HasIndex(t => new { t.LeagueId, t.SleeperRosterId })
            .IsUnique();

        // Configure indexes for performance
        modelBuilder.Entity<Contract>()
            .HasIndex(c => new { c.TeamId, c.Status });

        modelBuilder.Entity<Contract>()
            .HasIndex(c => new { c.PlayerId, c.Status });

        modelBuilder.Entity<Contract>()
            .HasIndex(c => new { c.LeagueId, c.EndSeason });

        modelBuilder.Entity<Trade>()
            .HasIndex(t => new { t.LeagueId, t.Status });

        modelBuilder.Entity<DraftPick>()
            .HasIndex(d => new { d.CurrentTeamId, d.Season });

        modelBuilder.Entity<CapTransaction>()
            .HasIndex(c => new { c.TeamId, c.Season });

        modelBuilder.Entity<Player>()
            .HasIndex(p => p.SearchFullName);

        modelBuilder.Entity<ExpiredContract>()
            .HasIndex(e => new { e.TeamId, e.Season });

        modelBuilder.Entity<CapAdjustment>()
            .HasIndex(c => c.TeamId);

        modelBuilder.Entity<CapAdjustment>()
            .HasIndex(c => c.LeagueId);

        modelBuilder.Entity<TradeHistory>()
            .HasIndex(t => t.LeagueId);

        modelBuilder.Entity<TradeHistory>()
            .HasIndex(t => t.TradeYear);

        modelBuilder.Entity<TradeHistory>()
            .HasIndex(t => new { t.Team1Id, t.Team2Id });

        modelBuilder.Entity<PlayerSeasonStat>()
            .HasIndex(p => new { p.PlayerId, p.Season })
            .IsUnique();

        modelBuilder.Entity<PlayerSeasonStat>()
            .HasIndex(p => new { p.Season, p.TotalFantasyPoints });

        modelBuilder.Entity<PlayerSeasonStat>()
            .HasIndex(p => new { p.Season, p.AvgPointsPerGame });

        // Configure decimal precision
        modelBuilder.Entity<League>()
            .Property(l => l.SalaryCap)
            .HasPrecision(10, 2);

        modelBuilder.Entity<Contract>()
            .Property(c => c.Salary)
            .HasPrecision(10, 2);

        modelBuilder.Entity<Contract>()
            .Property(c => c.DeadCapHit)
            .HasPrecision(10, 2);

        modelBuilder.Entity<CapAdjustment>()
            .Property(c => c.Amount2026)
            .HasPrecision(10, 2);

        modelBuilder.Entity<CapAdjustment>()
            .Property(c => c.Amount2027)
            .HasPrecision(10, 2);

        modelBuilder.Entity<CapAdjustment>()
            .Property(c => c.Amount2028)
            .HasPrecision(10, 2);

        modelBuilder.Entity<CapAdjustment>()
            .Property(c => c.Amount2029)
            .HasPrecision(10, 2);

        modelBuilder.Entity<CapAdjustment>()
            .Property(c => c.Amount2030)
            .HasPrecision(10, 2);

        // Configure delete behaviors
        modelBuilder.Entity<Contract>()
            .HasOne(c => c.Team)
            .WithMany(t => t.Contracts)
            .HasForeignKey(c => c.TeamId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Team>()
            .HasOne(t => t.League)
            .WithMany(l => l.Teams)
            .HasForeignKey(t => t.LeagueId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
