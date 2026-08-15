import type { TRegisterValues } from "@/schemas/register.schema";
import type { WheelSegment } from "./campaign.types";
import { apiRequest } from "./api.client";
import { participantSession } from "./participant-session";
import { permissionService } from "./permission.services";
import { getAccessToken } from "zmp-sdk/apis";

const PARTICIPANT_AUTH_MODE = String(
  import.meta.env.VITE_PARTICIPANT_AUTH_MODE || "preview"
).toLowerCase();

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
  return participant;
}

export const participantService = {
  isZaloMode() {
    return PARTICIPANT_AUTH_MODE === "zalo";
  },

  getToken: participantSession.getToken,
  clearSession: participantSession.clear,

  async startPreview(phone: string): Promise<Participant> {
    return saveResponse(await apiRequest<ParticipantApiResponse>("/participant/sessions/preview", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }));
  },

  async startWithZalo(accessToken: string, phoneToken: string, zaloName?: string): Promise<Participant> {
    return saveResponse(await apiRequest<ParticipantApiResponse>("/participant/sessions/zalo", {
      method: "POST",
      body: JSON.stringify({ accessToken, phoneToken, zaloName }),
    }));
  },

  async authenticate(phone: string, options: { phoneToken?: string; zaloName?: string } = {}): Promise<Participant> {
    if (!this.isZaloMode()) return this.startPreview(phone);

    const phoneResult = options.phoneToken
      ? { token: options.phoneToken }
      : await permissionService.getPhoneNumber();
    if (!phoneResult.token) {
      throw new Error(phoneResult.error || "Zalo phone verification is required");
    }
    const accessToken = await getAccessToken();
    return this.startWithZalo(accessToken, phoneResult.token, options.zaloName);
  },

  async lookupCustomerByPhone(phone: string): Promise<Participant | null> {
    try {
      return await this.startPreview(phone);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 404) return null;
      throw error;
    }
  },

  async getCurrent(): Promise<Participant | null> {
    if (!participantSession.getToken()) return null;
    try {
      return saveResponse(await apiRequest<ParticipantApiResponse>("/participant/me"));
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        participantSession.clear();
        return null;
      }
      throw error;
    }
  },

  async save(values: TRegisterValues, options: { phoneToken?: string; zaloName?: string } = {}): Promise<Participant> {
    return this.authenticate(values.phone, options);
  },
};
