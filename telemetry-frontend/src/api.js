const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';


const handleResponse = async (response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  return response.json();
};


export const fetchCurrentStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/telemetry/current`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching current status:', error);
    throw error;
  }
};


export const fetchTelemetry = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.startTime) {
      queryParams.append('start_time', params.startTime);
    }
    if (params.endTime) {
      queryParams.append('end_time', params.endTime);
    }
    if (params.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    
    const url = `${API_BASE_URL}/api/v1/telemetry${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching telemetry data:', error);
    throw error;
  }
};


export const fetchAnomalies = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.startTime) {
      queryParams.append('start_time', params.startTime);
    }
    if (params.endTime) {
      queryParams.append('end_time', params.endTime);
    }
    if (params.limit) {
      queryParams.append('limit', params.limit.toString());
    }
    
    const url = `${API_BASE_URL}/api/v1/telemetry/anomalies${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    throw error;
  }
};


export const fetchAggregations = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.startTime) {
      queryParams.append('start_time', params.startTime);
    }
    if (params.endTime) {
      queryParams.append('end_time', params.endTime);
    }
    if (params.bucketSize) {
      queryParams.append('bucket_size', params.bucketSize);
    }
    
    const url = `${API_BASE_URL}/api/v1/telemetry/aggregations${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching aggregations:', error);
    throw error;
  }
};


export const fetchMinAggregations = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.startTime) {
      queryParams.append('start_time', params.startTime);
    }
    if (params.endTime) {
      queryParams.append('end_time', params.endTime);
    }
    if (params.bucketSize) {
      queryParams.append('bucket_size', params.bucketSize);
    }
    
    const url = `${API_BASE_URL}/api/v1/telemetry/aggregations/min${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching min aggregations:', error);
    throw error;
  }
};


export const fetchMaxAggregations = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.startTime) {
      queryParams.append('start_time', params.startTime);
    }
    if (params.endTime) {
      queryParams.append('end_time', params.endTime);
    }
    if (params.bucketSize) {
      queryParams.append('bucket_size', params.bucketSize);
    }
    
    const url = `${API_BASE_URL}/api/v1/telemetry/aggregations/max${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching max aggregations:', error);
    throw error;
  }
};


export const healthCheck = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error checking health:', error);
    throw error;
  }
}; 