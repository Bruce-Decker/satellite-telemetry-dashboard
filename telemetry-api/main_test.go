package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)


type MockDB struct {
	telemetryData   []Telemetry
	anomalyData     []Anomaly
	aggregationData []AggregationResult
	currentStatus   CurrentStatus
}

func (m *MockDB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return nil, nil
}

func (m *MockDB) QueryRow(query string, args ...interface{}) *sql.Row {
	return nil
}

func (m *MockDB) Exec(query string, args ...interface{}) (sql.Result, error) {
	return nil, nil
}

func setupTestApp() *fiber.App {
	db = &sql.DB{} 

	app := fiber.New()

	api := app.Group("/api/v1")
	api.Get("/telemetry", getTelemetry)
	api.Get("/telemetry/current", getCurrentStatus)
	api.Get("/telemetry/anomalies", getAnomalies)
	api.Get("/telemetry/aggregations", getAggregations)
	api.Get("/telemetry/aggregations/min", getMinAggregations)
	api.Get("/telemetry/aggregations/max", getMaxAggregations)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "healthy",
			"time":   time.Now(),
		})
	})

	return app
}

func TestHealthEndpoint(t *testing.T) {
	app := setupTestApp()

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)

	assert.Equal(t, "healthy", result["status"])
	assert.NotNil(t, result["time"])
}


func TestTelemetryStructValidation(t *testing.T) {
	validTelemetry := Telemetry{
		ID:             1,
		Timestamp:      time.Now(),
		PacketID:       123,
		PacketSeqCtrl:  1,
		SubsystemID:    1,
		Temperature:    25.5,
		Battery:        85.0,
		Altitude:       520.0,
		SignalStrength: -45.0,
		IsAnomaly:      false,
		CreatedAt:      time.Now(),
	}

	assert.Equal(t, 1, validTelemetry.ID)
	assert.NotZero(t, validTelemetry.Timestamp)
	assert.GreaterOrEqual(t, validTelemetry.Temperature, float32(0.0))
	assert.GreaterOrEqual(t, validTelemetry.Battery, float32(0.0))
	assert.LessOrEqual(t, validTelemetry.Battery, float32(100.0))
	assert.GreaterOrEqual(t, validTelemetry.Altitude, float32(0.0))
}

func TestAnomalyStructValidation(t *testing.T) {
	validAnomaly := Anomaly{
		ID:             1,
		TelemetryID:    1,
		Timestamp:      time.Now(),
		AnomalyType:    "HIGH_TEMPERATURE",
		ParameterName:  "temperature",
		ParameterValue: 38.5,
		ThresholdValue: 35.0,
		Severity:       "WARNING",
		Acknowledged:   false,
		CreatedAt:      time.Now(),
	}

	assert.Equal(t, 1, validAnomaly.ID)
	assert.Equal(t, 1, validAnomaly.TelemetryID)
	assert.NotZero(t, validAnomaly.Timestamp)
	assert.Equal(t, "HIGH_TEMPERATURE", validAnomaly.AnomalyType)
	assert.Equal(t, "temperature", validAnomaly.ParameterName)
	assert.Greater(t, validAnomaly.ParameterValue, float32(0.0))
	assert.Greater(t, validAnomaly.ThresholdValue, float32(0.0))
}

func TestAggregationResultStructValidation(t *testing.T) {
	validAggregation := AggregationResult{
		Bucket:            time.Now(),
		SubsystemID:       1,
		AvgTemperature:    25.5,
		MinTemperature:    20.0,
		MaxTemperature:    30.0,
		AvgBattery:        85.0,
		MinBattery:        80.0,
		MaxBattery:        90.0,
		AvgAltitude:       520.0,
		MinAltitude:       515.0,
		MaxAltitude:       525.0,
		AvgSignalStrength: -45.0,
		MinSignalStrength: -50.0,
		MaxSignalStrength: -40.0,
		PacketCount:       100,
		AnomalyCount:      5,
	}

	assert.NotZero(t, validAggregation.Bucket)
	assert.Equal(t, 1, validAggregation.SubsystemID)
	assert.GreaterOrEqual(t, validAggregation.AvgTemperature, float32(0.0))
	assert.GreaterOrEqual(t, validAggregation.MinTemperature, float32(0.0))
	assert.GreaterOrEqual(t, validAggregation.MaxTemperature, float32(0.0))
	assert.GreaterOrEqual(t, validAggregation.AvgBattery, float32(0.0))
	assert.LessOrEqual(t, validAggregation.AvgBattery, float32(100.0))
	assert.GreaterOrEqual(t, validAggregation.MinBattery, float32(0.0))
	assert.LessOrEqual(t, validAggregation.MinBattery, float32(100.0))
	assert.GreaterOrEqual(t, validAggregation.MaxBattery, float32(0.0))
	assert.LessOrEqual(t, validAggregation.MaxBattery, float32(100.0))
	assert.GreaterOrEqual(t, validAggregation.AvgAltitude, float32(0.0))
	assert.GreaterOrEqual(t, validAggregation.MinAltitude, float32(0.0))
	assert.GreaterOrEqual(t, validAggregation.MaxAltitude, float32(0.0))
	assert.Equal(t, 100, validAggregation.PacketCount)
	assert.Equal(t, 5, validAggregation.AnomalyCount)
}


func BenchmarkGetTelemetry(b *testing.B) {
	app := setupTestApp()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/v1/telemetry", nil)
		resp, _ := app.Test(req)
		resp.Body.Close()
	}
}

func BenchmarkGetCurrentStatus(b *testing.B) {
	app := setupTestApp()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/v1/telemetry/current", nil)
		resp, _ := app.Test(req)
		resp.Body.Close()
	}
}
