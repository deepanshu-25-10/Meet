import React from 'react';
import { Participant } from '../../types';
import { VideoTile } from './VideoTile';
import { Users, Clock } from 'lucide-react';

interface VideoGridProps {
  selfParticipant: Participant;
  remoteParticipants: Participant[];
  pinnedId: string | null;
  onTogglePin: (id: string) => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  selfParticipant,
  remoteParticipants,
  pinnedId,
  onTogglePin,
}) => {
  const allParticipants = [selfParticipant, ...remoteParticipants];
  const count = allParticipants.length;

  // Grid layout class based on count
  const getGridClasses = () => {
    if (pinnedId) {
      return 'grid grid-cols-1 md:grid-cols-4 gap-3';
    }
    if (count === 1) return 'grid grid-cols-1 max-w-4xl mx-auto h-full max-h-[78vh]';
    if (count === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-3 max-w-5xl mx-auto h-full max-h-[78vh]';
    if (count <= 4) return 'grid grid-cols-1 sm:grid-cols-2 gap-3 h-full max-h-[82vh]';
    if (count <= 6) return 'grid grid-cols-2 md:grid-cols-3 gap-3 h-full max-h-[82vh]';
    if (count <= 9) return 'grid grid-cols-2 md:grid-cols-3 gap-2.5 h-full max-h-[85vh]';
    return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 h-full max-h-[85vh]';
  };

  if (count === 1) {
    return (
      <div className="w-full h-full flex flex-col justify-center items-center relative p-3">
        <div className="w-full h-full max-w-4xl max-h-[75vh]">
          <VideoTile
            participant={selfParticipant}
            isSelf={true}
            isPinned={pinnedId === selfParticipant.socketId}
            onTogglePin={() => onTogglePin(selfParticipant.socketId)}
          />
        </div>
      </div>
    );
  }

  // Pinned layout: One large spotlight tile + side carousel/strip
  if (pinnedId) {
    const pinnedParticipant = allParticipants.find((p) => p.socketId === pinnedId) || allParticipants[0];
    const otherParticipants = allParticipants.filter((p) => p.socketId !== pinnedParticipant.socketId);

    return (
      <div className="w-full h-full flex flex-col lg:flex-row gap-3 p-3 max-h-[84vh]">
        {/* Main Pinned View */}
        <div className="flex-1 h-full min-h-[350px]">
          <VideoTile
            participant={pinnedParticipant}
            isSelf={pinnedParticipant.socketId === selfParticipant.socketId}
            isPinned={true}
            onTogglePin={() => onTogglePin(pinnedParticipant.socketId)}
          />
        </div>

        {/* Side Strip */}
        <div className="lg:w-72 flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-y-auto max-h-full">
          {otherParticipants.map((p) => (
            <div key={p.socketId} className="w-48 lg:w-full h-36 flex-shrink-0">
              <VideoTile
                participant={p}
                isSelf={p.socketId === selfParticipant.socketId}
                isPinned={false}
                onTogglePin={() => onTogglePin(p.socketId)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full p-3 ${getGridClasses()}`}>
      {allParticipants.map((p) => (
        <div key={p.socketId} className="w-full h-full min-h-[180px]">
          <VideoTile
            participant={p}
            isSelf={p.socketId === selfParticipant.socketId}
            isPinned={false}
            onTogglePin={() => onTogglePin(p.socketId)}
          />
        </div>
      ))}
    </div>
  );
};
