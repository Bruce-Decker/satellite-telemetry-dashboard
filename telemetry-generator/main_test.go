package main

import (
	"bytes"
	"encoding/binary"
	"testing"
)

func TestRandomFloatRange(t *testing.T) {
	for i := 0; i < 100; i++ {
		val := randomFloat(10.0, 20.0)
		if val < 10.0 || val > 20.0 {
			t.Errorf("randomFloat out of range: got %f", val)
		}
	}
}

func TestGenerateTelemetryPayload_Normal(t *testing.T) {
	payload := generateTelemetryPayload(false)
	if payload.Temperature < 20.0 || payload.Temperature > 30.0 {
		t.Errorf("Temperature out of normal range: %f", payload.Temperature)
	}
	if payload.Battery < 70.0 || payload.Battery > 100.0 {
		t.Errorf("Battery out of normal range: %f", payload.Battery)
	}
	if payload.Altitude < 500.0 || payload.Altitude > 550.0 {
		t.Errorf("Altitude out of normal range: %f", payload.Altitude)
	}
	if payload.Signal < -60.0 || payload.Signal > -40.0 {
		t.Errorf("Signal out of normal range: %f", payload.Signal)
	}
}

func TestGenerateTelemetryPayload_Anomaly(t *testing.T) {
	foundAnomaly := false
	for i := 0; i < 100; i++ {
		payload := generateTelemetryPayload(true)
		if payload.Temperature > 35.0 || payload.Battery < 40.0 || payload.Altitude < 400.0 || payload.Signal < -80.0 {
			foundAnomaly = true
			break
		}
	}
	if !foundAnomaly {
		t.Error("generateTelemetryPayload(true) did not generate any anomaly in 100 tries")
	}
}

func TestCreateTelemetryPacket(t *testing.T) {
	seq := uint16(42)
	packet := createTelemetryPacket(&seq)
	if len(packet) == 0 {
		t.Fatal("Packet is empty")
	}


	buf := bytes.NewReader(packet)
	var primary CCSDSPrimaryHeader
	var secondary CCSDSSecondaryHeader
	var payload TelemetryPayload
	if err := binary.Read(buf, binary.BigEndian, &primary); err != nil {
		t.Fatalf("Failed to decode primary header: %v", err)
	}
	if err := binary.Read(buf, binary.BigEndian, &secondary); err != nil {
		t.Fatalf("Failed to decode secondary header: %v", err)
	}
	if err := binary.Read(buf, binary.BigEndian, &payload); err != nil {
		t.Fatalf("Failed to decode payload: %v", err)
	}

	if primary.PacketID == 0 {
		t.Error("PacketID should not be zero")
	}
	if secondary.SubsystemID == 0 {
		t.Error("SubsystemID should not be zero")
	}
}
