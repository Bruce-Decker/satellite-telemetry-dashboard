package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/adaptor/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Telemetry struct {
	ID             int       `json:"id"`
	Timestamp      time.Time `json:"timestamp"`
	PacketID       int       `json:"packet_id"`
	PacketSeqCtrl  int       `json:"packet_seq_ctrl"`
	SubsystemID    int       `json:"subsystem_id"`
	Temperature    float32   `json:"temperature"`
	Battery        float32   `json:"battery"`
	Altitude       float32   `json:"altitude"`
	SignalStrength float32   `json:"signal_strength"`
	IsAnomaly      bool      `json:"is_anomaly"`
	AnomalyType    *string   `json:"anomaly_type,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type Anomaly struct {
	ID             int        `json:"id"`
	TelemetryID    int        `json:"telemetry_id"`
	Timestamp      time.Time  `json:"timestamp"`
	AnomalyType    string     `json:"anomaly_type"`
	ParameterName  string     `json:"parameter_name"`
	ParameterValue float32    `json:"parameter_value"`
	ThresholdValue float32    `json:"threshold_value"`
	Severity       string     `json:"severity"`
	Acknowledged   bool       `json:"acknowledged"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type AggregationResult struct {
	Bucket            time.Time `json:"bucket"`
	SubsystemID       int       `json:"subsystem_id"`
	AvgTemperature    float32   `json:"avg_temperature"`
	MinTemperature    float32   `json:"min_temperature"`
	MaxTemperature    float32   `json:"max_temperature"`
	AvgBattery        float32   `json:"avg_battery"`
	MinBattery        float32   `json:"min_battery"`
	MaxBattery        float32   `json:"max_battery"`
	AvgAltitude       float32   `json:"avg_altitude"`
	MinAltitude       float32   `json:"min_altitude"`
	MaxAltitude       float32   `json:"max_altitude"`
	AvgSignalStrength float32   `json:"avg_signal_strength"`
	MinSignalStrength float32   `json:"min_signal_strength"`
	MaxSignalStrength float32   `json:"max_signal_strength"`
	PacketCount       int       `json:"packet_count"`
	AnomalyCount      int       `json:"anomaly_count"`
}

type CurrentStatus struct {
	LatestTelemetry Telemetry `json:"latest_telemetry"`
	AnomalyCount    int       `json:"anomaly_count"`
	Status          string    `json:"status"`
	LastUpdate      time.Time `json:"last_update"`
}

var db *sql.DB

func main() {

	initDatabase()

	app := fiber.New()

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	// Expose Prometheus metrics endpoint
	app.Get("/metrics", adaptor.HTTPHandler(promhttp.Handler()))

	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("test ok")
	})

	api := app.Group("/api/v1")

	api.Get("/telemetry", getTelemetry)
	api.Get("/telemetry/current", getCurrentStatus)
	api.Get("/telemetry/anomalies", getAnomalies)
	api.Get("/telemetry/aggregations", getAggregations)
	api.Get("/telemetry/aggregations/min", getMinAggregations)
	api.Get("/telemetry/aggregations/max", getMaxAggregations)
	api.Get("/telemetry/anomalies/count", getAnomalyCount)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "healthy",
			"time":   time.Now(),
		})
	})

	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Telemetry API service started on port %s", port)
	log.Fatal(app.Listen(":" + port))
}

func initDatabase() {
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")

	if dbHost == "" {
		dbHost = "localhost"
	}
	if dbPort == "" {
		dbPort = "5432"
	}
	if dbName == "" {
		dbName = "telemetry"
	}
	if dbUser == "" {
		dbUser = "telemetry_user"
	}
	if dbPassword == "" {
		dbPassword = "telemetry_pass"
	}

	connStr := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=disable",
		dbHost, dbPort, dbName, dbUser, dbPassword)

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	log.Println("Successfully connected to database")
}

func getTelemetry(c *fiber.Ctx) error {
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")
	limit := c.Query("limit", "100")

	query := `
		SELECT id, timestamp, packet_id, packet_seq_ctrl, subsystem_id,
			   temperature, battery, altitude, signal_strength, is_anomaly, 
			   anomaly_type, created_at
		FROM telemetry
		WHERE 1=1
	`

	args := []interface{}{}
	argCount := 0

	if startTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp >= $%d", argCount)
		args = append(args, startTime)
	}

	if endTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp <= $%d", argCount)
		args = append(args, endTime)
	}

	query += " ORDER BY timestamp DESC"

	if limit != "" {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		limitInt, _ := strconv.Atoi(limit)
		args = append(args, limitInt)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to query telemetry data",
			"details": err.Error(),
		})
	}
	defer rows.Close()

	telemetry := make([]Telemetry, 0)

	for rows.Next() {
		var t Telemetry
		err := rows.Scan(
			&t.ID, &t.Timestamp, &t.PacketID, &t.PacketSeqCtrl, &t.SubsystemID,
			&t.Temperature, &t.Battery, &t.Altitude, &t.SignalStrength,
			&t.IsAnomaly, &t.AnomalyType, &t.CreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		telemetry = append(telemetry, t)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating rows: %v", err)
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to iterate telemetry data",
			"details": err.Error(),
		})
	}

	return c.JSON(telemetry)
}

func getCurrentStatus(c *fiber.Ctx) error {
	fmt.Println("DEBUG: getCurrentStatus handler called")

	var latest Telemetry
	query := `
		SELECT id, timestamp, packet_id, packet_seq_ctrl, subsystem_id,
			   temperature, battery, altitude, signal_strength, is_anomaly, 
			   anomaly_type, created_at
		FROM telemetry
		ORDER BY timestamp DESC
		LIMIT 1
	`

	err := db.QueryRow(query).Scan(
		&latest.ID, &latest.Timestamp, &latest.PacketID, &latest.PacketSeqCtrl, &latest.SubsystemID,
		&latest.Temperature, &latest.Battery, &latest.Altitude, &latest.SignalStrength,
		&latest.IsAnomaly, &latest.AnomalyType, &latest.CreatedAt,
	)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to get current telemetry",
			"details": err.Error(),
		})
	}

	var anomalyCount int
	anomalyQuery := `
		SELECT COUNT(*)
		FROM telemetry
		WHERE is_anomaly = true
		AND timestamp >= NOW() - INTERVAL '24 hours'
	`

	err = db.QueryRow(anomalyQuery).Scan(&anomalyCount)
	if err != nil {
		log.Printf("Error getting anomaly count: %v", err)
		anomalyCount = 0
	}

	status := "NORMAL"
	if latest.IsAnomaly {
		status = "ANOMALY"
	} else if anomalyCount > 0 {
		status = "WARNING"
	}

	currentStatus := CurrentStatus{
		LatestTelemetry: latest,
		AnomalyCount:    anomalyCount,
		Status:          status,
		LastUpdate:      time.Now(),
	}

	return c.JSON(currentStatus)
}

func getAnomalies(c *fiber.Ctx) error {
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")
	limit := c.Query("limit", "100")

	query := `
		SELECT id, telemetry_id, timestamp, anomaly_type, parameter_name,
			   parameter_value, threshold_value, severity, acknowledged,
			   acknowledged_at, created_at
		FROM anomaly_history
		WHERE 1=1
	`

	args := []interface{}{}
	argCount := 0

	if startTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp >= $%d", argCount)
		args = append(args, startTime)
	}

	if endTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp <= $%d", argCount)
		args = append(args, endTime)
	}

	query += " ORDER BY timestamp DESC"

	if limit != "" {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		limitInt, _ := strconv.Atoi(limit)
		args = append(args, limitInt)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to query anomaly data",
			"details": err.Error(),
		})
	}
	defer rows.Close()

	var anomalies []Anomaly
	for rows.Next() {
		var a Anomaly
		err := rows.Scan(
			&a.ID, &a.TelemetryID, &a.Timestamp, &a.AnomalyType, &a.ParameterName,
			&a.ParameterValue, &a.ThresholdValue, &a.Severity, &a.Acknowledged,
			&a.AcknowledgedAt, &a.CreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning anomaly row: %v", err)
			continue
		}
		anomalies = append(anomalies, a)
	}

	return c.JSON(anomalies)
}

func getAggregations(c *fiber.Ctx) error {
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")
	bucketSize := c.Query("bucket_size", "1 hour")

	query := `
		SELECT time_bucket($1, timestamp) AS bucket,
			   subsystem_id,
			   AVG(temperature) as avg_temperature,
			   MIN(temperature) as min_temperature,
			   MAX(temperature) as max_temperature,
			   AVG(battery) as avg_battery,
			   MIN(battery) as min_battery,
			   MAX(battery) as max_battery,
			   AVG(altitude) as avg_altitude,
			   MIN(altitude) as min_altitude,
			   MAX(altitude) as max_altitude,
			   AVG(signal_strength) as avg_signal_strength,
			   MIN(signal_strength) as min_signal_strength,
			   MAX(signal_strength) as max_signal_strength,
			   COUNT(*) as packet_count,
			   COUNT(*) FILTER (WHERE is_anomaly) as anomaly_count
		FROM telemetry
		WHERE 1=1
	`

	args := []interface{}{bucketSize}
	argCount := 1

	if startTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp >= $%d", argCount)
		args = append(args, startTime)
	}

	if endTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp <= $%d", argCount)
		args = append(args, endTime)
	}

	query += `
		GROUP BY bucket, subsystem_id
		ORDER BY bucket DESC
	`

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to query aggregation data",
			"details": err.Error(),
		})
	}
	defer rows.Close()

	var aggregations []AggregationResult
	for rows.Next() {
		var a AggregationResult
		err := rows.Scan(
			&a.Bucket, &a.SubsystemID,
			&a.AvgTemperature, &a.MinTemperature, &a.MaxTemperature,
			&a.AvgBattery, &a.MinBattery, &a.MaxBattery,
			&a.AvgAltitude, &a.MinAltitude, &a.MaxAltitude,
			&a.AvgSignalStrength, &a.MinSignalStrength, &a.MaxSignalStrength,
			&a.PacketCount, &a.AnomalyCount,
		)
		if err != nil {
			log.Printf("Error scanning aggregation row: %v", err)
			continue
		}
		aggregations = append(aggregations, a)
	}

	return c.JSON(aggregations)
}

func getMinAggregations(c *fiber.Ctx) error {
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")
	bucketSize := c.Query("bucket_size", "1 hour")

	query := `
		SELECT time_bucket($1, timestamp) AS bucket,
			   subsystem_id,
			   MIN(temperature) as min_temperature,
			   MIN(battery) as min_battery,
			   MIN(altitude) as min_altitude,
			   MIN(signal_strength) as min_signal_strength,
			   COUNT(*) as packet_count,
			   COUNT(*) FILTER (WHERE is_anomaly) as anomaly_count
		FROM telemetry
		WHERE 1=1
	`

	args := []interface{}{bucketSize}
	argCount := 1

	if startTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp >= $%d", argCount)
		args = append(args, startTime)
	}

	if endTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp <= $%d", argCount)
		args = append(args, endTime)
	}

	query += `
		GROUP BY bucket, subsystem_id
		ORDER BY bucket DESC
	`

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to query min aggregation data",
			"details": err.Error(),
		})
	}
	defer rows.Close()

	type MinAggregationResult struct {
		Bucket            time.Time `json:"bucket"`
		SubsystemID       int       `json:"subsystem_id"`
		MinTemperature    float32   `json:"min_temperature"`
		MinBattery        float32   `json:"min_battery"`
		MinAltitude       float32   `json:"min_altitude"`
		MinSignalStrength float32   `json:"min_signal_strength"`
		PacketCount       int       `json:"packet_count"`
		AnomalyCount      int       `json:"anomaly_count"`
	}

	var aggregations []MinAggregationResult
	for rows.Next() {
		var a MinAggregationResult
		err := rows.Scan(
			&a.Bucket, &a.SubsystemID,
			&a.MinTemperature, &a.MinBattery, &a.MinAltitude, &a.MinSignalStrength,
			&a.PacketCount, &a.AnomalyCount,
		)
		if err != nil {
			log.Printf("Error scanning min aggregation row: %v", err)
			continue
		}
		aggregations = append(aggregations, a)
	}

	return c.JSON(aggregations)
}

func getMaxAggregations(c *fiber.Ctx) error {
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")
	bucketSize := c.Query("bucket_size", "1 hour")

	query := `
		SELECT time_bucket($1, timestamp) AS bucket,
			   subsystem_id,
			   MAX(temperature) as max_temperature,
			   MAX(battery) as max_battery,
			   MAX(altitude) as max_altitude,
			   MAX(signal_strength) as max_signal_strength,
			   COUNT(*) as packet_count,
			   COUNT(*) FILTER (WHERE is_anomaly) as anomaly_count
		FROM telemetry
		WHERE 1=1
	`

	args := []interface{}{bucketSize}
	argCount := 1

	if startTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp >= $%d", argCount)
		args = append(args, startTime)
	}

	if endTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp <= $%d", argCount)
		args = append(args, endTime)
	}

	query += `
		GROUP BY bucket, subsystem_id
		ORDER BY bucket DESC
	`

	rows, err := db.Query(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to query max aggregation data",
			"details": err.Error(),
		})
	}
	defer rows.Close()

	type MaxAggregationResult struct {
		Bucket            time.Time `json:"bucket"`
		SubsystemID       int       `json:"subsystem_id"`
		MaxTemperature    float32   `json:"max_temperature"`
		MaxBattery        float32   `json:"max_battery"`
		MaxAltitude       float32   `json:"max_altitude"`
		MaxSignalStrength float32   `json:"max_signal_strength"`
		PacketCount       int       `json:"packet_count"`
		AnomalyCount      int       `json:"anomaly_count"`
	}

	var aggregations []MaxAggregationResult
	for rows.Next() {
		var a MaxAggregationResult
		err := rows.Scan(
			&a.Bucket, &a.SubsystemID,
			&a.MaxTemperature, &a.MaxBattery, &a.MaxAltitude, &a.MaxSignalStrength,
			&a.PacketCount, &a.AnomalyCount,
		)
		if err != nil {
			log.Printf("Error scanning max aggregation row: %v", err)
			continue
		}
		aggregations = append(aggregations, a)
	}

	return c.JSON(aggregations)
}

func getAnomalyCount(c *fiber.Ctx) error {
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")

	query := `SELECT COUNT(*) FROM anomaly_history WHERE 1=1`
	args := []interface{}{}
	argCount := 0

	if startTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp >= $%d", argCount)
		args = append(args, startTime)
	}
	if endTime != "" {
		argCount++
		query += fmt.Sprintf(" AND timestamp <= $%d", argCount)
		args = append(args, endTime)
	}

	var count int
	err := db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to get anomaly count",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{"count": count})
}
