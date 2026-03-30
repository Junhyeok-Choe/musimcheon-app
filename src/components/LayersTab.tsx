'use client';

import { useMapStore } from '@/store/mapStore';
import { LAYER_CONFIG } from '@/utils/constants';
import { LayerKey } from '@/types';

const LAYER_KEYS = Object.keys(LAYER_CONFIG) as LayerKey[];

export default function LayersTab() {
  const visibleLayers = useMapStore((s) => s.visibleLayers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="text-[12px] text-slate-400 mb-2">
        지도에 표시할 레이어를 선택하세요
      </div>

      {LAYER_KEYS.map((key) => {
        const config = LAYER_CONFIG[key];
        const isOn = visibleLayers[key];

        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
              isOn
                ? 'border-blue-200 bg-blue-50/50'
                : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <span className={`text-[13px] font-medium ${isOn ? 'text-blue-700' : 'text-slate-600'}`}>
              {config.label}
            </span>
            <span className="ml-auto">
              <span
                className={`inline-block w-8 h-4 rounded-full relative transition-colors ${
                  isOn ? 'bg-blue-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    isOn ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
