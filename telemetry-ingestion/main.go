package main

import (
	"bytes"
	"database/sql"
	"encoding/binary"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type CCSDSPrimaryHeader struct {
	PacketID      uint16
	PacketSeqCtrl uint16
	PacketLength  uint16
}

type CCSDSSecondaryHeader struct {
	Timestamp   uint64
	SubsystemID uint16
}

type TelemetryPayload struct {
	Temperature float32
	Battery     float32
	Altitude    float32
	Signal      float32
}

var db *sql.DB
var (
	temperatureGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "satellite_temperature_celsius",
		Help: "Current satellite temperature in Celsius",
	})
	batteryGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "satellite_battery_percent",
		Help: "Current satellite battery level in percent",
	})
	altitudeGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "satellite_altitude_km",
		Help: "Current satellite altitude in kilometers",
	})
	signalStrengthGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "satellite_signal_strength_db",
		Help: "Current satellite signal strength in dB",
	})
	packetCounter = promauto.NewCounter(prometheus.CounterOpts{
		Name: "satellite_packet_count",
		Help: "Total number of telemetry packets ingested",
	})
	anomalyCounter = promauto.NewCounter(prometheus.CounterOpts{
		Name: "satellite_anomaly_count",
		Help: "Total number of detected anomalies",
	})
)

func main() {

	initDatabase()

	udpPort := os.Getenv("UDP_PORT")
	if udpPort == "" {
		udpPort = "8090"
	}

	
	go startHealthServer()

	
	addr := fmt.Sprintf(":%s", udpPort)
	conn, err := net.ListenPacket("udp", addr)
	if err != nil {
		log.Fatal("Failed to create UDP server:", err)
	}
	defer conn.Close()

	log.Printf("Telemetry ingestion service started on port %s", udpPort)

	buffer := make([]byte, 1024)

	go startMetricsServer()

	for {
		n, addr, err := conn.ReadFrom(buffer)
		if err != nil {
			log.Printf("Error reading from UDP: %v", err)
			continue
		}

		log.Printf("Received %d bytes from %s", n, addr)

		go processPacket(buffer[:n])
	}
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

func processPacket(data []byte) {

	telemetry, err := parseCCSDSPacket(data)
	if err != nil {
		log.Printf("Error parsing CCSDS packet: %v", err)
		return
	}

	err = storeTelemetry(telemetry)
	if err != nil {
		log.Printf("Error storing telemetry: %v", err)
		return
	}

	temperatureGauge.Set(float64(telemetry.Temperature))
	batteryGauge.Set(float64(telemetry.Battery))
	altitudeGauge.Set(float64(telemetry.Altitude))
	signalStrengthGauge.Set(float64(telemetry.Signal))

	packetCounter.Inc()

	if telemetry.Temperature < 0 || telemetry.Temperature > 100 ||
		telemetry.Battery < 20 || telemetry.Battery > 100 ||
		telemetry.Altitude < 300 || telemetry.Altitude > 550 ||
		telemetry.Signal < -90 || telemetry.Signal > -40 {
		anomalyCounter.Inc()
	}

	log.Printf("Stored telemetry: Temp=%.2f°C, Battery=%.2f%%, Alt=%.2fkm, Signal=%.2fdB",
		telemetry.Temperature, telemetry.Battery, telemetry.Altitude, telemetry.Signal)
}

func parseCCSDSPacket(data []byte) (*TelemetryPayload, error) {
	if len(data) < 16 {
		return nil, fmt.Errorf("packet too short: %d bytes", len(data))
	}

	buf := bytes.NewReader(data)

	var primaryHeader CCSDSPrimaryHeader
	err := binary.Read(buf, binary.BigEndian, &primaryHeader)
	if err != nil {
		return nil, fmt.Errorf("error reading primary header: %v", err)
	}

	var secondaryHeader CCSDSSecondaryHeader
	err = binary.Read(buf, binary.BigEndian, &secondaryHeader)
	if err != nil {
		return nil, fmt.Errorf("error reading secondary header: %v", err)
	}

	var payload TelemetryPayload
	err = binary.Read(buf, binary.BigEndian, &payload)
	if err != nil {
		return nil, fmt.Errorf("error reading payload: %v", err)
	}

	return &payload, nil
}

func storeTelemetry(payload *TelemetryPayload) error {
	query := `
		INSERT INTO telemetry (
			timestamp, packet_id, packet_seq_ctrl, subsystem_id,
			temperature, battery, altitude, signal_strength
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8
		)
	`

	_, err := db.Exec(query,
		time.Now(),
		1,
		1,
		1,
		payload.Temperature,
		payload.Battery,
		payload.Altitude,
		payload.Signal,
	)

	return err
}

func startHealthServer() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("healthy"))
	})

	log.Println("Health server started on :8091")
	if err := http.ListenAndServe(":8091", nil); err != nil {
		log.Printf("Health server error: %v", err)
	}
}

func startMetricsServer() {
	http.Handle("/metrics", promhttp.Handler())
	log.Println("Metrics server started on :8090")
	if err := http.ListenAndServe(":8090", nil); err != nil {
		log.Printf("Metrics server error: %v", err)
	}
}
