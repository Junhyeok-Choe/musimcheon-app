import { create } from 'zustand';
import { Restaurant, RestaurantGeoJSON, RoutingGraphData, CategoryType, SortMode, TabType, LayerKey, RouteResult } from '@/types';

// [STORE-01] Process raw GeoJSON into UI-friendly Restaurant objects
function processRestaurants(geojson: RestaurantGeoJSON): Restaurant[] {
  return geojson.features.map((f, idx) => ({
    id: idx,
    name: f.properties.restaurant_name,
    category: f.properties.category,
    categoryDisplay: f.properties.category_display || '',
    rating: f.properties.avg_rating ?? 0,
    reviewsKakao: f.properties.review_count_kakao ?? 0,
    reviewsNaver: f.properties.review_count_naver ?? 0,
    address: f.properties.road_address,
    keywords: f.properties.top_keywords || [],
    kakaoLink: f.properties.kakao_link,
    naverLink: f.properties.naver_link,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
}

// [STORE-02] Application state interface
interface MapState {
  // Data
  restaurants: Restaurant[];
  routingGraph: RoutingGraphData | null;
  isLoading: boolean;

  // UI state
  activeTab: TabType;
  selectedRestaurant: Restaurant | null;
  searchQuery: string;
  activeCategory: CategoryType | null;
  sortMode: SortMode;

  // Navigation state
  startPoint: { lat: number; lng: number } | null;
  destination: Restaurant | null;
  routeResult: RouteResult | null;

  // Layer visibility
  visibleLayers: Record<LayerKey, boolean>;

  // Actions
  setRestaurants: (geojson: RestaurantGeoJSON) => void;
  setRoutingGraph: (graph: RoutingGraphData) => void;
  setLoading: (loading: boolean) => void;
  setActiveTab: (tab: TabType) => void;
  selectRestaurant: (restaurant: Restaurant | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: CategoryType | null) => void;
  setSortMode: (mode: SortMode) => void;
  setStartPoint: (point: { lat: number; lng: number } | null) => void;
  setDestination: (restaurant: Restaurant | null) => void;
  setRouteResult: (result: RouteResult | null) => void;
  toggleLayer: (layer: LayerKey) => void;
  resetNavigation: () => void;

  // Computed
  filteredRestaurants: () => Restaurant[];
}

// [STORE-03] Zustand store
export const useMapStore = create<MapState>((set, get) => ({
  restaurants: [],
  routingGraph: null,
  isLoading: true,

  activeTab: 'restaurants',
  selectedRestaurant: null,
  searchQuery: '',
  activeCategory: null,
  sortMode: 'rating',

  startPoint: null,
  destination: null,
  routeResult: null,

  visibleLayers: {
    adminDongs: true,
    busStops: false,
    spatialFacilities: false,
    transportFacilities: false,
    sidewalkCenterline: false,
    sidewalkBoundary: false,
    pedOnlyRoad: false,
    streetLamps: false,
    routingNodes: false,
  },

  setRestaurants: (geojson) => set({ restaurants: processRestaurants(geojson) }),
  setRoutingGraph: (graph) => set({ routingGraph: graph }),
  setLoading: (loading) => set({ isLoading: loading }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectRestaurant: (restaurant) => set({ selectedRestaurant: restaurant }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  setSortMode: (mode) => set({ sortMode: mode }),
  setStartPoint: (point) => set({ startPoint: point }),
  setDestination: (restaurant) => set({ destination: restaurant }),
  setRouteResult: (result) => set({ routeResult: result }),
  toggleLayer: (layer) =>
    set((state) => ({
      visibleLayers: {
        ...state.visibleLayers,
        [layer]: !state.visibleLayers[layer],
      },
    })),
  resetNavigation: () =>
    set({ startPoint: null, destination: null, routeResult: null }),

  // [STORE-04] Filtered and sorted restaurant list
  filteredRestaurants: () => {
    const { restaurants, searchQuery, activeCategory, sortMode } = get();
    let list = [...restaurants];

    // Filter by category
    if (activeCategory) {
      list = list.filter((r) => r.category === activeCategory);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }

    // Sort
    if (sortMode === 'rating') {
      list.sort((a, b) => b.rating - a.rating || (b.reviewsKakao + b.reviewsNaver) - (a.reviewsKakao + a.reviewsNaver));
    } else if (sortMode === 'reviews') {
      list.sort((a, b) => (b.reviewsKakao + b.reviewsNaver) - (a.reviewsKakao + a.reviewsNaver));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  },
}));
