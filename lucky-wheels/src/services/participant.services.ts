import type { TRegisterValues } from "@/schemas/register.schema";
import type { WheelSegment } from "./campaign.types";
import { apiRequest } from "./api.client";
import { participantSession } from "./participant-session";
import { authenticateParticipant } from "@/platform/participant-auth";

const PARTICIPANT_CACHE_TTL_MS = 30_000;
let cached: { participant: Participant; token: string; cachedAt: number } | null = null;
let inFlight: Promise<Participant | null> | null = null;

export interface Participant {
  id: string;
  name: string;
  phone: string;
  sex: "male" | "female" | "other";
  job: "student" | "worker" | "freelancer" | "other";
  spinsTotal: number;
  rewardsTotal: number;
  spinsRemaining: number;
  wheelSegments: WheelSegment[];
}

interface ParticipantApiResponse extends Participant {
  session?: { token: string; expiresAt: string };
}

function saveResponse(payload: ParticipantApiResponse): Participant {
  if (payload.session?.token && payload.session.expiresAt) {
    participantSession.save(payload.session);
  }
  const { session: _session, ...participant } = payload;
  const token = participantSession.getToken();
  if (token) {
    cached = { participant, token, cachedAt: Date.now() };
  }
  return participant;
}

export const participantService = {
  getToken: participantSession.getToken,
  clearSession() {
    cached = null;
    inFlight = null;
    participantSession.clear();
  },

  getCached(): Participant | null {
    const token = participantSession.getToken();
    if (!cached || !token || cached.token !== token || Date.now() - cached.cachedAt > PARTICIPANT_CACHE_TTL_MS) {
      return null;
    }
    return cached.participant;
  },

  updateCached(patch: Partial<Participant>): void {
    if (cached) {
      cached = {
        ...cached,
        participant: { ...cached.participant, ...patch },
        cachedAt: Date.now(),
      };
    }
  },

  clearCached(): void {
    cached = null;
    inFlight = null;
  },

  async authenticate(phone?: string): Promise<Participant> {
    return saveResponse(await authenticateParticipant<ParticipantApiResponse>(phone));
  },

  async lookupCustomerByPhone(phone: string): Promise<Participant | null> {
    try {
      return await this.authenticate(phone);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) return null;
      throw error;
    }
  },

  async getCurrent(options: { force?: boolean } = {}): Promise<Participant | null> {
    const token = participantSession.getToken();
    if (!token) {
      cached = null;
      return null;
    }

    if (!options.force) {
      const fresh = this.getCached();
      if (fresh) return fresh;
      if (inFlight) return inFlight;
    }

    inFlight = (async () => {
      try {
        const resp = await apiRequest<ParticipantApiResponse>("/participant/me");
        return saveResponse(resp);
      } catch (error) {
        if ((error as Error & { status?: number }).status === 401) {
          this.clearSession();
          return null;
        }
        throw error;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  },

  async save(values: TRegisterValues): Promise<Participant> {
    return this.authenticate(values.phone);
  },
};
