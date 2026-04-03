import { create } from 'zustand';
import { Restaurant, RestaurantGeoJSON, RoutingGraphData, CategoryType, SortMode, TabType, LayerKey, RouteResult, PlaceKind } from '@/types';
import { CrosswalkCoord } from '@/utils/pathfinding';

// [STORE-01] Process raw GeoJSON into UI-friendly Restaurant objects
function processPlaces(geojson: RestaurantGeoJSON, placeKind: PlaceKind): Restaurant[] {
  return geojson.features.map((f, idx) => ({
    id: idx,
    placeKind,
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
    // Date index scores
    scoreAtmosphere: f.properties.score_atmosphere ?? 0,
    scoreNoise: f.properties.score_noise ?? 0,
    scoreWaiting: f.properties.score_waiting ?? 0,
    scoreDistance: f.properties.score_distance ?? 0,
    scoreDateRatio: f.properties.score_visit_target ?? f.properties.score_date_ratio ?? 0,
    scoreVisitTarget: f.properties.score_visit_target ?? f.properties.score_date_ratio ?? 0,
    scoreTaste: f.properties.score_taste ?? 0,
    scoreService: f.properties.score_service ?? 0,
    scoreBase: f.properties.score_base ?? 0,
    scoreFinal: f.properties.score_final ?? f.properties.date_index ?? 0,
    dateIndex: f.properties.score_final ?? f.properties.date_index ?? 0,
    isFastfood: Boolean(f.properties.is_fastfood),
    isFranchise: Boolean(f.properties.is_franchise),
    excludeReason: f.properties.exclude_reason ?? null,
  }));
}

// [STORE-02] Application state interface
interface MapState {
  // Data
  restaurants: Restaurant[];
  cafes: Restaurant[];
  routingGraph: RoutingGraphData | null;
  crosswalks: CrosswalkCoord[];
  isLoading: boolean;

  // UI state
  activeTab: TabType;
  activePlaceKind: PlaceKind;
  selectedPlace: Restaurant | null;
  searchQuery: string;
  activeCategory: CategoryType | null;
  sortMode: SortMode;

  // Navigation state
  startRestaurant: Restaurant | null;
  destination: Restaurant | null;
  routeResult: RouteResult | null;

  // Layer visibility
  visibleLayers: Record<LayerKey, boolean>;

  // Actions
  setRestaurants: (geojson: RestaurantGeoJSON) => void;
  setCafes: (geojson: RestaurantGeoJSON) => void;
  setRoutingGraph: (graph: RoutingGraphData) => void;
  setCrosswalks: (coords: CrosswalkCoord[]) => void;
  setLoading: (loading: boolean) => void;
  setActiveTab: (tab: TabType) => void;
  setActivePlaceKind: (kind: PlaceKind) => void;
  selectPlace: (place: Restaurant | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: CategoryType | null) => void;
  setSortMode: (mode: SortMode) => void;
  setStartRestaurant: (restaurant: Restaurant | null) => void;
  setDestination: (restaurant: Restaurant | null) => void;
  setRouteResult: (result: RouteResult | null) => void;
  toggleLayer: (layer: LayerKey) => void;
  resetNavigation: () => void;

  // Computed
  filteredPlaces: () => Restaurant[];
}

// [STORE-03] Zustand store
export const useMapStore = create<MapState>((set, get) => ({
  restaurants: [],
  cafes: [],
  routingGraph: null,
  crosswalks: [],
  isLoading: true,

  activeTab: 'restaurants',
  activePlaceKind: 'restaurant',
  selectedPlace: null,
  searchQuery: '',
  activeCategory: null,
  sortMode: 'dateIndex',

  startRestaurant: null,
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
    crosswalks: false,
  },

  setRestaurants: (geojson) =>
    set({
      restaurants: processPlaces(geojson, 'restaurant').filter((restaurant) => !restaurant.excludeReason),
    }),
  setCafes: (geojson) =>
    set({
      cafes: processPlaces(geojson, 'cafe'),
    }),
  setRoutingGraph: (graph) => set({ routingGraph: graph }),
  setCrosswalks: (coords) => set({ crosswalks: coords }),
  setLoading: (loading) => set({ isLoading: loading }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActivePlaceKind: (kind) =>
    set((state) => ({
      activePlaceKind: kind,
      searchQuery: '',
      activeCategory: kind === 'restaurant' ? state.activeCategory : null,
      selectedPlace: state.selectedPlace?.placeKind === kind ? state.selectedPlace : null,
    })),
  selectPlace: (place) => set({ selectedPlace: place }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  setSortMode: (mode) => set({ sortMode: mode }),
  setStartRestaurant: (restaurant) => set({ startRestaurant: restaurant }),
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
    set({ startRestaurant: null, destination: null, routeResult: null }),

  // [STORE-04] Filtered and sorted place list
  filteredPlaces: () => {
    const { restaurants, cafes, activePlaceKind, searchQuery, activeCategory, sortMode } = get();
    let list = [...(activePlaceKind === 'restaurant' ? restaurants : cafes)];

    // Filter by category
    if (activePlaceKind === 'restaurant' && activeCategory) {
      list = list.filter((r) => r.category === activeCategory);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }

    // Sort
    if (sortMode === 'dateIndex') {
      list.sort((a, b) => b.dateIndex - a.dateIndex || b.rating - a.rating);
    } else if (sortMode === 'rating') {
      list.sort((a, b) => b.rating - a.rating || (b.reviewsKakao + b.reviewsNaver) - (a.reviewsKakao + a.reviewsNaver));
    } else if (sortMode === 'reviews') {
      list.sort((a, b) => (b.reviewsKakao + b.reviewsNaver) - (a.reviewsKakao + a.reviewsNaver));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  },
}));
