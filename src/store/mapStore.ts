import { create } from 'zustand';
import {
  CategoryType,
  LayerKey,
  OriginPoint,
  OriginSelectionMode,
  PlanOption,
  PlannerInput,
  PlaceKind,
  Restaurant,
  RestaurantGeoJSON,
  RoiGeometry,
  RouteResult,
  RoutingGraphData,
  SortMode,
  TabType,
} from '@/types';
import { CrosswalkCoord } from '@/utils/pathfinding';
import { normalizeRequestedTime } from '@/utils/hours';

function processPlaces(geojson: RestaurantGeoJSON, placeKind: PlaceKind): Restaurant[] {
  return geojson.features.map((feature, index) => ({
    id: index,
    placeKind,
    name: feature.properties.restaurant_name,
    category: feature.properties.category,
    categoryDisplay: feature.properties.category_display || '',
    rating: feature.properties.avg_rating ?? 0,
    reviewsKakao: feature.properties.review_count_kakao ?? 0,
    reviewsNaver: feature.properties.review_count_naver ?? 0,
    address: feature.properties.road_address,
    keywords: feature.properties.top_keywords || [],
    kakaoLink: feature.properties.kakao_link,
    naverLink: feature.properties.naver_link,
    lat: feature.geometry.coordinates[1],
    lng: feature.geometry.coordinates[0],
    scoreAtmosphere: feature.properties.score_atmosphere ?? 0,
    scoreNoise: feature.properties.score_noise ?? 0,
    scoreWaiting: feature.properties.score_waiting ?? 0,
    scoreDistance: feature.properties.score_distance ?? 0,
    scoreDateRatio: feature.properties.score_visit_target ?? feature.properties.score_date_ratio ?? 0,
    scoreVisitTarget: feature.properties.score_visit_target ?? feature.properties.score_date_ratio ?? 0,
    scoreTaste: feature.properties.score_taste ?? 0,
    scoreService: feature.properties.score_service ?? 0,
    scoreBase: feature.properties.score_base ?? 0,
    scoreFinal: feature.properties.score_final ?? feature.properties.date_index ?? 0,
    dateIndex: feature.properties.score_final ?? feature.properties.date_index ?? 0,
    isFastfood: Boolean(feature.properties.is_fastfood),
    isFranchise: Boolean(feature.properties.is_franchise),
    excludeReason: feature.properties.exclude_reason ?? null,
    operatingScheduleSummary: feature.properties.operating_schedule_summary ?? null,
    openTime: feature.properties.open_time ?? null,
    closeTime: feature.properties.close_time ?? null,
    breakTime: feature.properties.break_time ?? null,
    holiday: feature.properties.holiday ?? null,
    lastOrder: feature.properties.last_order ?? null,
    hoursConfidence: feature.properties.hours_confidence ?? 'low',
    hoursSource: feature.properties.hours_source ?? null,
  }));
}

interface MapState {
  restaurants: Restaurant[];
  cafes: Restaurant[];
  routingGraph: RoutingGraphData | null;
  validatedCrosswalks: CrosswalkCoord[];
  candidateCrosswalks: CrosswalkCoord[];
  roiGeometry: RoiGeometry | null;
  isLoading: boolean;

  activeTab: TabType;
  activePlaceKind: PlaceKind;
  selectedPlace: Restaurant | null;
  searchQuery: string;
  activeCategory: CategoryType | null;
  sortMode: SortMode;
  visibleLayers: Record<LayerKey, boolean>;

  origin: OriginPoint | null;
  originSelectionMode: OriginSelectionMode;
  plannerInput: PlannerInput;
  plannerError: string | null;
  planOptions: PlanOption[];
  selectedPlan: PlanOption | null;
  routeResult: RouteResult | null;

  setRestaurants: (geojson: RestaurantGeoJSON) => void;
  setCafes: (geojson: RestaurantGeoJSON) => void;
  setRoutingGraph: (graph: RoutingGraphData) => void;
  setValidatedCrosswalks: (coords: CrosswalkCoord[]) => void;
  setCandidateCrosswalks: (coords: CrosswalkCoord[]) => void;
  setRoiGeometry: (roi: RoiGeometry) => void;
  setLoading: (loading: boolean) => void;

  setActiveTab: (tab: TabType) => void;
  setActivePlaceKind: (kind: PlaceKind) => void;
  selectPlace: (place: Restaurant | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: CategoryType | null) => void;
  setSortMode: (mode: SortMode) => void;
  toggleLayer: (layer: LayerKey) => void;

  setOrigin: (origin: OriginPoint | null) => void;
  setOriginSelectionMode: (mode: OriginSelectionMode) => void;
  setPlannerRequestedStartTime: (time: string) => void;
  setPlannerError: (message: string | null) => void;
  setPlanOptions: (options: PlanOption[]) => void;
  setSelectedPlan: (option: PlanOption | null) => void;
  setRouteResult: (result: RouteResult | null) => void;
  resetPlanner: () => void;

  filteredPlaces: () => Restaurant[];
}

export const useMapStore = create<MapState>((set, get) => ({
  restaurants: [],
  cafes: [],
  routingGraph: null,
  validatedCrosswalks: [],
  candidateCrosswalks: [],
  roiGeometry: null,
  isLoading: true,

  activeTab: 'planner',
  activePlaceKind: 'restaurant',
  selectedPlace: null,
  searchQuery: '',
  activeCategory: null,
  sortMode: 'dateIndex',
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

  origin: null,
  originSelectionMode: 'idle',
  plannerInput: {
    origin: null,
    requestedStartTime: normalizeRequestedTime(''),
  },
  plannerError: null,
  planOptions: [],
  selectedPlan: null,
  routeResult: null,

  setRestaurants: (geojson) =>
    set({
      restaurants: processPlaces(geojson, 'restaurant').filter((place) => !place.excludeReason),
    }),
  setCafes: (geojson) =>
    set({
      cafes: processPlaces(geojson, 'cafe'),
    }),
  setRoutingGraph: (graph) => set({ routingGraph: graph }),
  setValidatedCrosswalks: (coords) => set({ validatedCrosswalks: coords }),
  setCandidateCrosswalks: (coords) => set({ candidateCrosswalks: coords }),
  setRoiGeometry: (roi) => set({ roiGeometry: roi }),
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
  toggleLayer: (layer) =>
    set((state) => ({
      visibleLayers: {
        ...state.visibleLayers,
        [layer]: !state.visibleLayers[layer],
      },
    })),

  setOrigin: (origin) =>
    set((state) => ({
      origin,
      plannerInput: {
        ...state.plannerInput,
        origin,
      },
      plannerError: null,
      planOptions: [],
      selectedPlan: null,
      routeResult: null,
    })),
  setOriginSelectionMode: (mode) => set({ originSelectionMode: mode }),
  setPlannerRequestedStartTime: (time) =>
    set((state) => ({
      plannerInput: {
        ...state.plannerInput,
        requestedStartTime: normalizeRequestedTime(time),
      },
      planOptions: [],
      selectedPlan: null,
      routeResult: null,
    })),
  setPlannerError: (plannerError) => set({ plannerError }),
  setPlanOptions: (planOptions) => set({ planOptions }),
  setSelectedPlan: (selectedPlan) =>
    set({
      selectedPlan,
      routeResult: selectedPlan?.combinedRoute ?? null,
    }),
  setRouteResult: (routeResult) => set({ routeResult }),
  resetPlanner: () =>
    set((state) => ({
      origin: null,
      originSelectionMode: 'idle',
      plannerInput: {
        ...state.plannerInput,
        origin: null,
      },
      plannerError: null,
      planOptions: [],
      selectedPlan: null,
      routeResult: null,
    })),

  filteredPlaces: () => {
    const { restaurants, cafes, activePlaceKind, searchQuery, activeCategory, sortMode } = get();
    let list = [...(activePlaceKind === 'restaurant' ? restaurants : cafes)];

    if (activePlaceKind === 'restaurant' && activeCategory) {
      list = list.filter((place) => place.category === activeCategory);
    }

    if (searchQuery) {
      const normalized = searchQuery.toLowerCase();
      list = list.filter((place) => place.name.toLowerCase().includes(normalized));
    }

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
