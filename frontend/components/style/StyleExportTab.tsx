import PresetGrid from './PresetGrid';
import FineTunePanel from './FineTunePanel';
import ExportCards from './ExportCards';
import { useVideoStore } from '../../store/videoStore';

export default function StyleExportTab() {
  const captionStyle = useVideoStore((state) => state.captionStyle);
  return <div className="space-y-6 p-4 pb-8">
    <PresetGrid selected={captionStyle.preset} onSelect={(style) => useVideoStore.getState().applyCaptionPreset(style)} />
    <FineTunePanel style={captionStyle} />
    <ExportCards />
  </div>;
}
