import axios from 'axios';
import { env } from '../config/env';

export const getRouteGeometry = async (start: [number, number], end: [number, number]) => {
  if (!env.ORS_API_KEY) {
    console.warn('ORS_API_KEY is not set. Skipping route generation.');
    return null;
  }

  try {
    const response = await axios.post(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        coordinates: [start, end],
      },
      {
        headers: {
          Authorization: env.ORS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 3000,
      }
    );

    const feature = response.data.features[0];
    return {
      geometry: feature.geometry,
      distanceKm: feature.properties.segments[0].distance / 1000,
      durationMins: feature.properties.segments[0].duration / 60,
    };
  } catch (error) {
    console.error('Error fetching route from ORS', error);
    return null;
  }
};
