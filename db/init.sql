CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS telemetry (
    id SERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    packet_id INTEGER NOT NULL,
    packet_seq_ctrl INTEGER NOT NULL,
    subsystem_id INTEGER NOT NULL,
    temperature REAL NOT NULL,
    battery REAL NOT NULL,
    altitude REAL NOT NULL,
    signal_strength REAL NOT NULL,
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);


CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_anomaly ON telemetry (is_anomaly, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_subsystem ON telemetry (subsystem_id, timestamp DESC);


SELECT create_hypertable('telemetry', 'timestamp', if_not_exists => TRUE);


CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_hourly_avg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS bucket,
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
GROUP BY bucket, subsystem_id;


CREATE TABLE IF NOT EXISTS anomaly_history (
    id SERIAL,
    telemetry_id INTEGER NOT NULL,
    telemetry_timestamp TIMESTAMPTZ NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    anomaly_type VARCHAR(50) NOT NULL,
    parameter_name VARCHAR(50) NOT NULL,
    parameter_value REAL NOT NULL,
    threshold_value REAL NOT NULL,
    severity VARCHAR(20) DEFAULT 'WARNING',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);


CREATE INDEX IF NOT EXISTS idx_anomaly_history_timestamp ON anomaly_history (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_history_type ON anomaly_history (anomaly_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_history_acknowledged ON anomaly_history (acknowledged, timestamp DESC);


SELECT create_hypertable('anomaly_history', 'timestamp', if_not_exists => TRUE);


CREATE OR REPLACE FUNCTION detect_anomaly()
RETURNS TRIGGER AS $$
DECLARE
    anomaly_detected BOOLEAN := FALSE;
    anomaly_type_val VARCHAR(50) := '';
    param_name VARCHAR(50) := '';
    threshold_val REAL := 0;
BEGIN
    IF NEW.temperature > 35.0 THEN
        anomaly_detected := TRUE;
        anomaly_type_val := 'HIGH_TEMPERATURE';
        param_name := 'temperature';
        threshold_val := 35.0;
    ELSIF NEW.temperature < 20.0 THEN
        anomaly_detected := TRUE;
        anomaly_type_val := 'LOW_TEMPERATURE';
        param_name := 'temperature';
        threshold_val := 20.0;
    END IF;


    IF NEW.battery < 40.0 THEN
        anomaly_detected := TRUE;
        anomaly_type_val := 'LOW_BATTERY';
        param_name := 'battery';
        threshold_val := 40.0;
    END IF;


    IF NEW.altitude < 400.0 THEN
        anomaly_detected := TRUE;
        anomaly_type_val := 'LOW_ALTITUDE';
        param_name := 'altitude';
        threshold_val := 400.0;
    END IF;


    IF NEW.signal_strength < -80.0 THEN
        anomaly_detected := TRUE;
        anomaly_type_val := 'WEAK_SIGNAL';
        param_name := 'signal_strength';
        threshold_val := -80.0;
    END IF;


    IF anomaly_detected THEN
        NEW.is_anomaly := TRUE;
        NEW.anomaly_type := anomaly_type_val;
        
        INSERT INTO anomaly_history (
            telemetry_id, telemetry_timestamp, timestamp, anomaly_type, parameter_name, 
            parameter_value, threshold_value
        ) VALUES (
            NEW.id, NEW.timestamp, NEW.timestamp, anomaly_type_val, param_name,
            CASE 
                WHEN param_name = 'temperature' THEN NEW.temperature
                WHEN param_name = 'battery' THEN NEW.battery
                WHEN param_name = 'altitude' THEN NEW.altitude
                WHEN param_name = 'signal_strength' THEN NEW.signal_strength
            END,
            threshold_val
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trigger_detect_anomaly ON telemetry;
CREATE TRIGGER trigger_detect_anomaly
    BEFORE INSERT ON telemetry
    FOR EACH ROW
    EXECUTE FUNCTION detect_anomaly();


GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO telemetry_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO telemetry_user; 