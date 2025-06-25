package main

import (
	"bytes"
	"encoding/binary"
	"log"
	"math/rand"
	"net"
	"time"
)


type CCSDSPrimaryHeader struct {
	PacketID      uint16 
	PacketSeqCtrl uint16 
	PacketLength  uint16 
}


type CCSDSSecondaryHeader struct {
	Timestamp    uint64 
	SubsystemID  uint16 
}

// Telemetry Payload
type TelemetryPayload struct {
	Temperature float32 
	Battery     float32 
	Altitude    float32 
	Signal      float32 
}

const (
	APID           = 0x01
	PACKET_VERSION = 0x0
	PACKET_TYPE    = 0x0 
	SEC_HDR_FLAG   = 0x1 
	SEQ_FLAGS      = 0x3 
	SUBSYSTEM_ID   = 0x0001 
)

func main() {

	rand.Seed(time.Now().UnixNano())


	conn, err := net.Dial("udp", "telemetry-ingestion:8090")
	if err != nil {
		log.Fatal("Failed to connect to telemetry ingestion service:", err)
	}
	defer conn.Close()

	log.Println("Telemetry generator started. Sending packets to telemetry-ingestion:8090")

	packetCount := uint16(0)
	for {
		data := createTelemetryPacket(&packetCount)
		_, err := conn.Write(data)
		if err != nil {
			log.Printf("Error sending telemetry: %v", err)
			time.Sleep(5 * time.Second) 
			continue
		}

		if packetCount%5 == 0 {
			log.Printf("Sent anomalous telemetry packet #%d", packetCount)
		} else {
			log.Printf("Sent normal telemetry packet #%d", packetCount)
		}

		time.Sleep(1 * time.Second)
		packetCount++
	}
}

func createTelemetryPacket(seqCount *uint16) []byte {
	buf := new(bytes.Buffer)


	packetID := uint16(PACKET_VERSION)<<13 |
		uint16(PACKET_TYPE)<<12 |
		uint16(SEC_HDR_FLAG)<<11 |
		uint16(APID)


	packetSeqCtrl := uint16(SEQ_FLAGS)<<14 | (*seqCount & 0x3FFF)


	payload := generateTelemetryPayload(*seqCount%5 == 0)


	packetDataLength := uint16(binary.Size(CCSDSSecondaryHeader{}) +
		binary.Size(TelemetryPayload{}) - 1)

	primaryHeader := CCSDSPrimaryHeader{
		PacketID:      packetID,
		PacketSeqCtrl: packetSeqCtrl,
		PacketLength:  packetDataLength,
	}


	secondaryHeader := CCSDSSecondaryHeader{
		Timestamp:   uint64(time.Now().Unix()),
		SubsystemID: SUBSYSTEM_ID,
	}


	binary.Write(buf, binary.BigEndian, primaryHeader) 
	binary.Write(buf, binary.BigEndian, secondaryHeader)
	binary.Write(buf, binary.BigEndian, payload)

	return buf.Bytes()
}

func generateTelemetryPayload(generateAnomaly bool) TelemetryPayload {
	if generateAnomaly {

		anomalyType := rand.Intn(4)
		switch anomalyType {
		case 0:
			return TelemetryPayload{
				Temperature: randomFloat(35.0, 40.0), 
				Battery:     randomFloat(70.0, 100.0),
				Altitude:    randomFloat(500.0, 550.0),
				Signal:      randomFloat(-60.0, -40.0),
			}
		case 1:
			return TelemetryPayload{
				Temperature: randomFloat(20.0, 30.0),
				Battery:     randomFloat(20.0, 40.0), 
				Altitude:    randomFloat(500.0, 550.0),
				Signal:      randomFloat(-60.0, -40.0),
			}
		case 2:
			return TelemetryPayload{
				Temperature: randomFloat(20.0, 30.0),
				Battery:     randomFloat(70.0, 100.0),
				Altitude:    randomFloat(300.0, 400.0), 
				Signal:      randomFloat(-60.0, -40.0),
			}
		default:
			return TelemetryPayload{
				Temperature: randomFloat(20.0, 30.0),
				Battery:     randomFloat(70.0, 100.0),
				Altitude:    randomFloat(500.0, 550.0),
				Signal:      randomFloat(-90.0, -80.0), 
			}
		}
	}

	return TelemetryPayload{
		Temperature: randomFloat(20.0, 30.0), 
		Battery:     randomFloat(70.0, 100.0), 
		Altitude:    randomFloat(500.0, 550.0), 
		Signal:      randomFloat(-60.0, -40.0), 
	}
}

func randomFloat(min, max float32) float32 {
	return min + rand.Float32()*(max-min)
} 