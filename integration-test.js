const axios = require('axios');

const API_BASE_URL = 'http://localhost:8080';


const testConfig = {
  timeout: 10000,
  retries: 3,
  delay: 2000
};


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const testEndpoint = async (endpoint, description) => {
  console.log(`Testing ${description}...`);
  
  for (let i = 0; i < testConfig.retries; i++) {
    try {
      const response = await axios.get(`${API_BASE_URL}${endpoint}`, {
        timeout: testConfig.timeout
      });
      
      console.log(`✅ ${description} - Status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.log(`❌ ${description} - Attempt ${i + 1}/${testConfig.retries} failed: ${error.message}`);
      
      if (i < testConfig.retries - 1) {
        console.log(`⏳ Retrying in ${testConfig.delay}ms...`);
        await sleep(testConfig.delay);
      } else {
        throw error;
      }
    }
  }
};

const validateTelemetryData = (data) => {
  console.log(data);
  if (data === null || data === undefined) {
    throw new Error('Telemetry API returned null or undefined');
  }
  if (!Array.isArray(data)) {
    throw new Error('Telemetry API did not return an array');
  }
  
  if (data.length > 0) {
    const firstRecord = data[0];
    const requiredFields = ['id', 'timestamp', 'temperature', 'battery', 'altitude', 'signal_strength'];
    
    for (const field of requiredFields) {
      if (!(field in firstRecord)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
  
  console.log(`✅ Telemetry data validation passed - ${data.length} records`);
};

const validateCurrentStatus = (data) => {
  const requiredFields = ['latest_telemetry', 'anomaly_count', 'status', 'last_update'];
  
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`Missing required field in current status: ${field}`);
    }
  }
  
  console.log(`✅ Current status validation passed - Status: ${data.status}`);
};

const validateAnomalies = (data) => {
  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid anomalies data format');
  }
  
  console.log(`✅ Anomalies validation passed - ${data.length} anomalies found`);
};

const validateAggregations = (data) => {
  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid aggregations data format');
  }
  
  if (data.length > 0) {
    const firstRecord = data[0];
    const requiredFields = ['bucket', 'avg_temperature', 'avg_battery', 'avg_altitude', 'avg_signal_strength'];
    
    for (const field of requiredFields) {
      if (!(field in firstRecord)) {
        throw new Error(`Missing required field in aggregations: ${field}`);
      }
    }
  }
  
  console.log(`✅ Aggregations validation passed - ${data.length} aggregation records`);
};

const validateMinAggregations = (data) => {
  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid min aggregations data format');
  }
  
  if (data.length > 0) {
    const firstRecord = data[0];
    const requiredFields = ['bucket', 'min_temperature', 'min_battery', 'min_altitude', 'min_signal_strength'];
    
    for (const field of requiredFields) {
      if (!(field in firstRecord)) {
        throw new Error(`Missing required field in min aggregations: ${field}`);
      }
    }
  }
  
  console.log(`✅ Min Aggregations validation passed - ${data.length} min aggregation records`);
};

const validateMaxAggregations = (data) => {
  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid max aggregations data format');
  }
  
  if (data.length > 0) {
    const firstRecord = data[0];
    const requiredFields = ['bucket', 'max_temperature', 'max_battery', 'max_altitude', 'max_signal_strength'];
    
    for (const field of requiredFields) {
      if (!(field in firstRecord)) {
        throw new Error(`Missing required field in max aggregations: ${field}`);
      }
    }
  }
  
  console.log(`✅ Max Aggregations validation passed - ${data.length} max aggregation records`);
};


const runIntegrationTests = async () => {
  console.log('🚀 Starting Integration Tests for Satellite Telemetry System\n');
  
  try {
    await testEndpoint('/health', 'Health Check');
    
    const currentStatus = await testEndpoint('/api/v1/telemetry/current', 'Current Telemetry');
    validateCurrentStatus(currentStatus);
    
    const telemetryData = await testEndpoint('/api/v1/telemetry', 'Historical Telemetry');
    if (!telemetryData) {
      throw new Error('Telemetry API returned null or undefined');
    }
    validateTelemetryData(telemetryData);
    
    const anomalies = await testEndpoint('/api/v1/telemetry/anomalies', 'Anomalies');
    validateAnomalies(anomalies);
    
    const aggregations = await testEndpoint('/api/v1/telemetry/aggregations', 'Aggregations');
    validateAggregations(aggregations);
    
    const minAggregations = await testEndpoint('/api/v1/telemetry/aggregations/min', 'Min Aggregations');
    validateMinAggregations(minAggregations);
    
    const maxAggregations = await testEndpoint('/api/v1/telemetry/aggregations/max', 'Max Aggregations');
    validateMaxAggregations(maxAggregations);
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const filteredData = await testEndpoint(
      `/api/v1/telemetry?start_time=${oneHourAgo.toISOString()}&end_time=${now.toISOString()}`,
      'Filtered Telemetry (Last Hour)'
    );
    validateTelemetryData(filteredData);
    
    console.log('\n All integration tests passed successfully!');
    console.log('\n Test Summary:');
    console.log('  ✅ Health check endpoint');
    console.log('  ✅ Current telemetry endpoint');
    console.log('  ✅ Historical telemetry endpoint');
    console.log('  ✅ Anomalies endpoint');
    console.log('  ✅ Aggregations endpoint');
    console.log('  ✅ Min aggregations endpoint');
    console.log('  ✅ Max aggregations endpoint');
    console.log('  ✅ Time-filtered queries');
    console.log('  ✅ Data validation');
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    process.exit(1);
  }
};


if (require.main === module) {
  runIntegrationTests();
}

module.exports = { runIntegrationTests }; 