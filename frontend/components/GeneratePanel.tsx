"use client";

interface GeneratePanelProps {
  onGenerate?: () => void;
}

export default function GeneratePanel({ onGenerate }: GeneratePanelProps) {
  return (
    <aside className="w-[380px] flex-shrink-0 border-l border-gray-800 bg-[#0d121f] p-6 flex flex-col justify-between h-full">
      <div>
        <h2 className="text-xl font-bold text-white mb-6">Generate</h2>
      </div>
      <div>
        <button
          onClick={onGenerate}
          className="w-full rounded-xl bg-orange-500 py-3.5 text-center font-semibold text-white shadow-lg transition hover:bg-orange-600 active:scale-[0.99]"
        >
          Generate Subtitles
        </button>
      </div>
    </aside>
  );
}
