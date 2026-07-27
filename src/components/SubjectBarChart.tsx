interface Props {
  lecturePercent: number
  hwPercent: number
  dppPercent: number
  size?: 'small' | 'large'
}

export default function SubjectBarChart({ lecturePercent, hwPercent, dppPercent, size = 'small' }: Props) {
  const bars = [
    { label: 'Lecture', percent: lecturePercent },
    { label: 'HW', percent: hwPercent },
    { label: 'DPP', percent: dppPercent },
  ]
  const height = size === 'large' ? 160 : 80

  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {bars.map((bar) => (
        <div key={bar.label} className="flex flex-col items-center flex-1">
          <div className="w-full bg-gray-800 rounded-t-md flex flex-col justify-end" style={{ height: height - 20 }}>
            <div
              className="bg-[#00E5FF] rounded-t-md transition-all"
              style={{ height: `${bar.percent}%` }}
            />
          </div>
          {size === 'large' && (
            <span className="text-xs text-gray-400 mt-1">{bar.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}