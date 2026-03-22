export interface WeatherStation {
  id: string;          // e.g. "KJFK"
  name: string;        // e.g. "New York Kennedy International"
  country: string;     // e.g. "USA"
  lat: number;
  lon: number;
  source_type: "both" | "ogimet" | "meteostat";
}

export const STATION_DATABASE: WeatherStation[] = [
  // North America
  { id: "KJFK", name: "New York Kennedy International", country: "USA", lat: 40.6413, lon: -73.7781, source_type: "both" },
  { id: "KLAX", name: "Los Angeles International", country: "USA", lat: 33.9416, lon: -118.4085, source_type: "both" },
  { id: "KORD", name: "Chicago O'Hare International", country: "USA", lat: 41.9742, lon: -87.9073, source_type: "both" },
  { id: "CYYZ", name: "Toronto Pearson International", country: "Canada", lat: 43.6777, lon: -79.6248, source_type: "both" },
  { id: "MMMX", name: "Mexico City International", country: "Mexico", lat: 19.4361, lon: -99.0719, source_type: "both" },

  // South America
  { id: "SBGR", name: "São Paulo/Guarulhos International", country: "Brazil", lat: -23.4356, lon: -46.4731, source_type: "both" },
  { id: "SAEZ", name: "Ministro Pistarini International", country: "Argentina", lat: -34.8222, lon: -58.5358, source_type: "both" },
  { id: "SKBO", name: "El Dorado International", country: "Colombia", lat: 4.7016, lon: -74.1469, source_type: "both" },

  // Europe
  { id: "EGLL", name: "London Heathrow", country: "UK", lat: 51.4700, lon: -0.4543, source_type: "both" },
  { id: "LFPG", name: "Paris Charles de Gaulle", country: "France", lat: 49.0097, lon: 2.5479, source_type: "both" },
  { id: "EDDF", name: "Frankfurt Airport", country: "Germany", lat: 50.0333, lon: 8.5706, source_type: "both" },
  { id: "LEMD", name: "Madrid Barajas", country: "Spain", lat: 40.4839, lon: -3.5680, source_type: "both" },
  { id: "LIRF", name: "Rome Fiumicino", country: "Italy", lat: 41.8003, lon: 12.2389, source_type: "both" },

  // Middle East & Africa
  { id: "OMDB", name: "Dubai International", country: "UAE", lat: 25.2532, lon: 55.3657, source_type: "both" },
  { id: "OERK", name: "King Khalid International", country: "Saudi Arabia", lat: 24.9576, lon: 46.6988, source_type: "both" },
  { id: "OEJN", name: "King Abdulaziz International", country: "Saudi Arabia", lat: 21.6796, lon: 39.1565, source_type: "both" },
  { id: "OEDF", name: "King Fahd International", country: "Saudi Arabia", lat: 26.4712, lon: 49.7979, source_type: "both" },
  { id: "HECA", name: "Cairo International", country: "Egypt", lat: 30.1219, lon: 31.4056, source_type: "both" },
  { id: "FAOR", name: "O.R. Tambo International", country: "South Africa", lat: -26.1367, lon: 28.2411, source_type: "both" },

  // Asia & Oceania
  { id: "VHHH", name: "Hong Kong International", country: "Hong Kong", lat: 22.3080, lon: 113.9185, source_type: "both" },
  { id: "RJTT", name: "Tokyo Haneda International", country: "Japan", lat: 35.5494, lon: 139.7798, source_type: "both" },
  { id: "WSSS", name: "Singapore Changi", country: "Singapore", lat: 1.3644, lon: 103.9915, source_type: "both" },
  { id: "YSSY", name: "Sydney Kingsford Smith", country: "Australia", lat: -33.9399, lon: 151.1753, source_type: "both" },
  { id: "NZAA", name: "Auckland International", country: "New Zealand", lat: -37.0082, lon: 174.7850, source_type: "both" },
  { id: "VIDP", name: "Indira Gandhi International", country: "India", lat: 28.5562, lon: 77.1000, source_type: "both" }
];
