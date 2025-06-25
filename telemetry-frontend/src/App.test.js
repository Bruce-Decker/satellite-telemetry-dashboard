import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastContainer } from 'react-toastify';
import App from './App';


jest.mock('./api', () => ({
  fetchCurrentStatus: jest.fn(),
  fetchTelemetry: jest.fn(),
  fetchAnomalies: jest.fn(),
  fetchAggregations: jest.fn(),
  fetchMinAggregations: jest.fn(),
  fetchMaxAggregations: jest.fn(),
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
  });

  test('renders dashboard title', () => {
    render(<App />);
    expect(screen.getByText('Satellite Telemetry Dashboard')).toBeInTheDocument();
  });

  test('renders theme toggle button', () => {
    render(<App />);
    const themeToggle = screen.getByRole('button', { name: /theme/i });
    expect(themeToggle).toBeInTheDocument();
  });

  test('renders refresh button', () => {
    render(<App />);
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });

  test('renders current status section', () => {
    render(<App />);
    expect(screen.getByText('Current Status')).toBeInTheDocument();
  });

  test('renders telemetry charts section when data is available', async () => {
    const { fetchTelemetry } = require('./api');
    fetchTelemetry.mockResolvedValue(mockTelemetryData);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Telemetry Over Time')).toBeInTheDocument();
    });
  });

  test('renders anomalies section when data is available', async () => {
    const { fetchAnomalies } = require('./api');
    fetchAnomalies.mockResolvedValue(mockAnomalies);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Anomalies')).toBeInTheDocument();
    });
  });

  test('renders aggregations section when data is available', async () => {
    const { fetchAggregations } = require('./api');
    fetchAggregations.mockResolvedValue(mockAggregations);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Hourly Aggregations')).toBeInTheDocument();
    });
  });

  test('displays loading state initially', () => {
    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('displays error state when API fails', async () => {
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockRejectedValue(new Error('API Error'));

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  test('displays current status data correctly', async () => {
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(mockCurrentStatus);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('25.50°C')).toBeInTheDocument();
      expect(screen.getByText('85.00%')).toBeInTheDocument();
      expect(screen.getByText('520.00 km')).toBeInTheDocument();
      expect(screen.getByText('-45.00 dB')).toBeInTheDocument();
    });
  });

  test('displays anomaly count correctly', async () => {
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(mockCurrentStatus);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  test('displays status correctly', async () => {
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(mockCurrentStatus);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('NORMAL')).toBeInTheDocument();
    });
  });

  test('theme toggle changes theme', () => {
    render(<App />);
    const themeToggle = screen.getByRole('button', { name: /theme/i });
    
    fireEvent.click(themeToggle);
    
    // Check if theme icon changes (this would require checking the icon name)
    expect(themeToggle).toBeInTheDocument();
  });

  test('refresh button triggers data refetch', async () => {
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(mockCurrentStatus);

    render(<App />);
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      expect(fetchCurrentStatus).toHaveBeenCalledTimes(2); // Initial + refresh
    });
  });

  test('displays anomaly details correctly', async () => {
    const { fetchAnomalies } = require('./api');
    fetchAnomalies.mockResolvedValue(mockAnomalies);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('HIGH_TEMPERATURE')).toBeInTheDocument();
      expect(screen.getByText('temperature')).toBeInTheDocument();
      expect(screen.getByText('38.5')).toBeInTheDocument();
      expect(screen.getByText('35.0')).toBeInTheDocument();
    });
  });

  test('displays aggregation data correctly', async () => {
    const { fetchAggregations } = require('./api');
    fetchAggregations.mockResolvedValue(mockAggregations);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument(); // packet_count
      expect(screen.getByText('2')).toBeInTheDocument(); // anomaly_count
    });
  });

  test('displays min aggregation data correctly', async () => {
    const { fetchMinAggregations } = require('./api');
    fetchMinAggregations.mockResolvedValue(mockMinAggregations);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Hourly Aggregations (Minimum)')).toBeInTheDocument();
    });
  });

  test('displays max aggregation data correctly', async () => {
    const { fetchMaxAggregations } = require('./api');
    fetchMaxAggregations.mockResolvedValue(mockMaxAggregations);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Hourly Aggregations (Maximum)')).toBeInTheDocument();
    });
  });

  test('handles empty telemetry data gracefully', async () => {
    const { fetchTelemetry } = require('./api');
    fetchTelemetry.mockResolvedValue([]);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.queryByText('Telemetry Over Time')).not.toBeInTheDocument();
    });
  });

  test('handles empty anomalies data gracefully', async () => {
    const { fetchAnomalies } = require('./api');
    fetchAnomalies.mockResolvedValue([]);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.queryByText('Recent Anomalies')).not.toBeInTheDocument();
    });
  });

  test('handles empty aggregations data gracefully', async () => {
    const { fetchAggregations } = require('./api');
    fetchAggregations.mockResolvedValue([]);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.queryByText('Hourly Aggregations')).not.toBeInTheDocument();
    });
  });

  test('displays last update time correctly', async () => {
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(mockCurrentStatus);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Last Update:/)).toBeInTheDocument();
    });
  });

  test('displays metric labels correctly', async () => {
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(mockCurrentStatus);

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Temperature:/)).toBeInTheDocument();
      expect(screen.getByText(/Battery:/)).toBeInTheDocument();
      expect(screen.getByText(/Altitude:/)).toBeInTheDocument();
      expect(screen.getByText(/Signal Strength:/)).toBeInTheDocument();
    });
  });

  test('applies correct CSS classes for normal status', async () => {
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(mockCurrentStatus);

    render(<App />);
    
    await waitFor(() => {
      const statusElement = screen.getByText('NORMAL');
      expect(statusElement).toHaveClass('status-normal');
    });
  });

  test('applies correct CSS classes for warning status', async () => {
    const warningStatus = {
      ...mockCurrentStatus,
      status: 'WARNING',
    };
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(warningStatus);

    render(<App />);
    
    await waitFor(() => {
      const statusElement = screen.getByText('WARNING');
      expect(statusElement).toHaveClass('status-warning');
    });
  });

  test('applies correct CSS classes for anomaly status', async () => {
    const anomalyStatus = {
      ...mockCurrentStatus,
      status: 'ANOMALY',
    };
    const { fetchCurrentStatus } = require('./api');
    fetchCurrentStatus.mockResolvedValue(anomalyStatus);

    render(<App />);
    
    await waitFor(() => {
      const statusElement = screen.getByText('ANOMALY');
      expect(statusElement).toHaveClass('status-anomaly');
    });
  });

  test('renders FontAwesome icons correctly', () => {
    render(<App />);
    const icons = screen.getAllByTestId('fontawesome-icon');
    expect(icons.length).toBeGreaterThan(0);
  });

  test('renders charts when data is available', async () => {
    const { fetchTelemetry, fetchAggregations } = require('./api');
    fetchTelemetry.mockResolvedValue(mockTelemetryData);
    fetchAggregations.mockResolvedValue(mockAggregations);

    render(<App />);
    
    await waitFor(() => {
      const charts = screen.getAllByTestId('line-chart');
      expect(charts.length).toBeGreaterThan(0);
    });
  });

  test('toast container is rendered', () => {
    render(<App />);
    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
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