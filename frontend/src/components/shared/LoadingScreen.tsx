export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-arena-950 flex flex-col items-center justify-center z-50">
      <div className="relative mb-6">
        <div className="w-16 h-16 border-2 border-cyber-700 rounded-full animate-spin border-t-cyber-400" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 bg-cyber-500 rounded-full animate-pulse" />
        </div>
      </div>
      <p className="text-cyber-400 text-xs tracking-[0.3em] uppercase animate-pulse">
        Loading
      </p>
    </div>
  );
}
