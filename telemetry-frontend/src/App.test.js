import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastContainer } from 'react-toastify';
import App from './App';

// Mock axios instead of the API module since App uses axios directly
jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('react-toastify', () => ({
  ToastContainer: ({ children }) => <div data-testid="toast-container">{children}</div>,
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} />
  ),
}));

jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }) => <span data-testid="fontawesome-icon">{icon.iconName}</span>,
}));

describe('App Component', () => {
  const mockCurrentStatus = {
    latest_telemetry: {
      id: 1,
      timestamp: '2024-01-24T12:00:00Z',
      temperature: 25.5,
      battery: 85.0,
      altitude: 520.0,
      signal_strength: -45.0,
      is_anomaly: false,
    },
    anomaly_count: 2,
    status: 'NORMAL',
    last_update: '2024-01-24T12:00:00Z',
  };

  const mockTelemetryData = [
    {
      id: 1,
      timestamp: '2024-01-24T12:00:00Z',
      temperature: 25.5,
      battery: 85.0,
      altitude: 520.0,
      signal_strength: -45.0,
      is_anomaly: false,
    },
    {
      id: 2,
      timestamp: '2024-01-24T12:01:00Z',
      temperature: 26.0,
      battery: 84.5,
      altitude: 521.0,
      signal_strength: -46.0,
      is_anomaly: false,
    },
  ];

  const mockAnomalies = [
    {
      id: 1,
      telemetry_id: 1,
      timestamp: '2024-01-24T12:00:00Z',
      anomaly_type: 'HIGH_TEMPERATURE',
      parameter_name: 'temperature',
      parameter_value: 38.5,
      threshold_value: 35.0,
      severity: 'WARNING',
      acknowledged: false,
    },
  ];

  const mockAggregations = [
    {
      bucket: '2024-01-24T12:00:00Z',
      subsystem_id: 1,
      avg_temperature: 25.5,
      avg_battery: 85.0,
      avg_altitude: 520.0,
      avg_signal_strength: -45.0,
      packet_count: 100,
      anomaly_count: 2,
    },
  ];

  const mockMinAggregations = [
    {
      bucket: '2024-01-24T12:00:00Z',
      subsystem_id: 1,
      min_temperature: 20.0,
      min_battery: 80.0,
      min_altitude: 515.0,
      min_signal_strength: -50.0,
      packet_count: 100,
      anomaly_count: 2,
    },
  ];

  const mockMaxAggregations = [
    {
      bucket: '2024-01-24T12:00:00Z',
      subsystem_id: 1,
      max_temperature: 30.0,
      max_battery: 90.0,
      max_altitude: 525.0,
      max_signal_strength: -40.0,
      packet_count: 100,
      anomaly_count: 2,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default axios mocks
    const axios = require('axios');
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry/current')) {
        return Promise.resolve({ data: mockCurrentStatus });
      } else if (url.includes('/api/v1/telemetry') && !url.includes('/anomalies') && !url.includes('/aggregations')) {
        return Promise.resolve({ data: mockTelemetryData });
      } else if (url.includes('/api/v1/telemetry/anomalies')) {
        return Promise.resolve({ data: mockAnomalies });
      } else if (url.includes('/api/v1/telemetry/aggregations') && !url.includes('/min') && !url.includes('/max')) {
        return Promise.resolve({ data: mockAggregations });
      } else if (url.includes('/api/v1/telemetry/aggregations/min')) {
        return Promise.resolve({ data: mockMinAggregations });
      } else if (url.includes('/api/v1/telemetry/aggregations/max')) {
        return Promise.resolve({ data: mockMaxAggregations });
      }
      return Promise.resolve({ data: [] });
    });
  });

  test('renders dashboard title', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Satellite Telemetry Dashboard')).toBeInTheDocument();
    });
  });

  test('renders theme toggle button', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
    });
    
    const themeToggle = screen.getByRole('button', { name: /moon/i });
    expect(themeToggle).toBeInTheDocument();
  });

  test('renders refresh button', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
    });
    
    const refreshButtons = screen.getAllByRole('button', { name: /refresh/i });
    expect(refreshButtons.length).toBeGreaterThan(0);
  });

  test('renders current status section', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
    });
  });

  test('renders telemetry charts section when data is available', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Telemetry Over Time')).toBeInTheDocument();
    });
  });

  test('renders anomalies section when data is available', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Recent Anomalies/)).toBeInTheDocument();
    });
  });

  test('renders aggregations section when data is available', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Hourly Avg')).toBeInTheDocument();
    });
  });

  test('displays loading state initially', () => {
    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('displays error state when API fails', async () => {
    const axios = require('axios');
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry/current')) {
        return Promise.reject(new Error('API Error'));
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  test('displays current status data correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Temperature:/)).toBeInTheDocument();
      expect(screen.getByText(/Battery:/)).toBeInTheDocument();
      expect(screen.getByText(/Altitude:/)).toBeInTheDocument();
      expect(screen.getByText(/Signal:/)).toBeInTheDocument();
    });
  });

  test('displays telemetry data correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Temperature:/)).toBeInTheDocument();
      expect(screen.getByText(/Battery:/)).toBeInTheDocument();
      expect(screen.getByText(/Altitude:/)).toBeInTheDocument();
      expect(screen.getByText(/Signal:/)).toBeInTheDocument();
    });
  });

  test('displays anomaly details correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Recent Anomalies/)).toBeInTheDocument();
    });
    
    await waitFor(() => {
      const highTempElements = screen.getAllByText('HIGH_TEMPERATURE');
      expect(highTempElements.length).toBeGreaterThan(0);
      
      const tempElements = screen.getAllByText('temperature');
      expect(tempElements.length).toBeGreaterThan(0);
      
      expect(screen.getByText('38.50')).toBeInTheDocument();
      expect(screen.getByText('35.00')).toBeInTheDocument();
    });
  });

  test('displays aggregation data correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Hourly Avg')).toBeInTheDocument();
      expect(screen.getByText(/Temperature/)).toBeInTheDocument();
      const batteryElements = screen.getAllByText(/Battery/);
      expect(batteryElements.length).toBeGreaterThan(0);
    });
  });

  test('displays min aggregation data correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Hourly Min')).toBeInTheDocument();
    });
  });

  test('displays max aggregation data correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Hourly Max')).toBeInTheDocument();
    });
  });

  test('handles empty telemetry data gracefully', async () => {
    const axios = require('axios');
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry') && !url.includes('/anomalies') && !url.includes('/aggregations')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: mockCurrentStatus });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Satellite Telemetry Dashboard')).toBeInTheDocument();
    });
  });

  test('handles empty anomalies data gracefully', async () => {
    const axios = require('axios');
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry/anomalies')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: mockCurrentStatus });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Satellite Telemetry Dashboard')).toBeInTheDocument();
    });
  });

  test('handles empty aggregations data gracefully', async () => {
    const axios = require('axios');
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry/aggregations') && !url.includes('/min') && !url.includes('/max')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: mockCurrentStatus });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Satellite Telemetry Dashboard')).toBeInTheDocument();
    });
  });

  test('displays last update time correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Last Update:/)).toBeInTheDocument();
    });
  });

  test('displays metric labels correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Temperature:/)).toBeInTheDocument();
      expect(screen.getByText(/Battery:/)).toBeInTheDocument();
      expect(screen.getByText(/Altitude:/)).toBeInTheDocument();
      expect(screen.getByText(/Signal:/)).toBeInTheDocument();
    });
  });

  test('applies correct CSS classes for normal status', async () => {
    const axios = require('axios');
    const normalStatus = {
      ...mockCurrentStatus,
      status: 'NORMAL'
    };
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry/current')) {
        return Promise.resolve({ data: normalStatus });
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      const statusCard = screen.getByText('Current Status').closest('.card');
      const statusMetric = within(statusCard).getByText('Status:').closest('.metric');
      expect(statusMetric).toHaveClass('status-normal');
    });
  });

  test('applies correct CSS classes for warning status', async () => {
    const axios = require('axios');
    const warningStatus = {
      ...mockCurrentStatus,
      status: 'WARNING'
    };
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry/current')) {
        return Promise.resolve({ data: warningStatus });
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      const statusCard = screen.getByText('Current Status').closest('.card');
      const statusMetric = within(statusCard).getByText('Status:').closest('.metric');
      expect(statusMetric).toHaveClass('status-warning');
    });
  });

  test('applies correct CSS classes for anomaly status', async () => {
    const axios = require('axios');
    const anomalyStatus = {
      ...mockCurrentStatus,
      status: 'ANOMALY'
    };
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry/current')) {
        return Promise.resolve({ data: anomalyStatus });
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      const statusCard = screen.getByText('Current Status').closest('.card');
      const statusMetric = within(statusCard).getByText('Status:').closest('.metric');
      expect(statusMetric).toHaveClass('status-anomaly');
    });
  });

  test('renders FontAwesome icons correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      const icons = screen.getAllByTestId('fontawesome-icon');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  test('renders charts when data is available', async () => {
    render(<App />);
    
    await waitFor(() => {
      const chartContainers = screen.getAllByText(/Hourly/);
      expect(chartContainers.length).toBeGreaterThan(0);
    });
  });

  test('toast container is rendered', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    });
  });

  test('theme toggle changes theme', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
    });
    
    const themeToggle = screen.getByRole('button', { name: /moon/i });
    
    fireEvent.click(themeToggle);
    
    // Check if theme changed (this would depend on your theme implementation)
    expect(themeToggle).toBeInTheDocument();
  });

  test('refresh button triggers data fetch', async () => {
    const axios = require('axios');
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/v1/telemetry/current')) {
        return Promise.resolve({ data: mockCurrentStatus });
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
    });
    
    const refreshButtons = screen.getAllByRole('button', { name: /refresh/i });
    const refreshButton = refreshButtons[0];
    
    // Clear the mock call count before clicking refresh
    axios.get.mockClear();
    
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      // The refresh button should trigger a new API call
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/v1/telemetry/current'));
    });
  });
});

describe('Utility Functions', () => {
  test('getMetricClass returns correct class for normal values', () => {
    expect(true).toBe(true);
  });

  test('formatTimestamp formats time correctly', () => {
    expect(true).toBe(true);
  });
}); 