import DnaHelix from './ui/DnaHelix'
import Waveform from './ui/Waveform'

/**
 * VoiceStage — the heart of the home screen: the living helix in its
 * true state (listening / thinking / speaking / success / error),
 * reacting to your microphone; the ribbon waveform breathing under it;
 * and one honest status line (partial transcript while you speak,
 * the agent's real tool activity while it thinks).
 */
export default function VoiceStage({ helixState, getLevel, statusLine }) {
  return (
    <div className="voice-stage">
      <DnaHelix
        state={helixState}
        size={120}
        getLevel={getLevel}
        label={`Assistant is ${helixState}`}
      />
      <div className="voice-stage__wave" aria-hidden="true">
        <Waveform getLevel={getLevel} height={38} />
      </div>
      <div className="voice-stage__status" aria-live="polite">
        {statusLine || ' '}
      </div>
    </div>
  )
}
