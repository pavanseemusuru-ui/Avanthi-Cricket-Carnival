import type { Player, Franchise, AuctionState, AuditLog, AdminPlayer, AdminFranchise } from '../types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response, defaultError: string): Promise<T> {
  if (!res.ok) {
    let errorDetail = defaultError;
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        errorDetail = json.detail || json.message || defaultError;
      } catch {
        errorDetail = text || defaultError;
      }
    } catch {
      errorDetail = defaultError;
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  // Roll number parser
  parseRollNumber: async (roll: string) => {
    const res = await fetch(`${API_BASE}/roll-parse?roll_number=${encodeURIComponent(roll)}`);
    return handleResponse<any>(res, 'Failed to parse roll number');
  },

  // Players
  getPublicPlayers: async (params?: { bucket?: string; course?: string; player_type?: string }): Promise<Player[]> => {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`${API_BASE}/players/public?${query}`);
    return handleResponse<Player[]>(res, 'Failed to fetch public players');
  },

  getAdminPlayers: async (): Promise<AdminPlayer[]> => {
    const res = await fetch(`${API_BASE}/players/admin`);
    return handleResponse<AdminPlayer[]>(res, 'Failed to fetch admin players');
  },

  registerPlayer: async (data: any): Promise<Player> => {
    const res = await fetch(`${API_BASE}/players/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Player>(res, 'Player registration failed');
  },

  markPlayerPaid: async (playerId: number, paid: boolean = true) => {
    const res = await fetch(`${API_BASE}/players/${playerId}/pay?paid=${paid}`, { method: 'PUT' });
    return handleResponse<any>(res, 'Failed to update payment status');
  },

  resolvePlayerProfile: async (playerId: number, cricheroesUrl: string, cricheroesMobile: string) => {
    const res = await fetch(
      `${API_BASE}/players/${playerId}/resolve-profile?cricheroes_url=${encodeURIComponent(cricheroesUrl)}&cricheroes_mobile=${encodeURIComponent(cricheroesMobile)}`,
      { method: 'PUT' }
    );
    return handleResponse<any>(res, 'Failed to resolve profile');
  },

  overridePlayerYear: async (playerId: number, overrideYear: number) => {
    const res = await fetch(
      `${API_BASE}/players/${playerId}/override-year?override_year=${overrideYear}`,
      { method: 'PUT' }
    );
    return handleResponse<any>(res, 'Failed to override year');
  },

  // Franchises
  getPublicFranchises: async (): Promise<Franchise[]> => {
    const res = await fetch(`${API_BASE}/franchises/public`);
    return handleResponse<Franchise[]>(res, 'Failed to fetch public franchises');
  },

  getAdminFranchises: async (): Promise<AdminFranchise[]> => {
    const res = await fetch(`${API_BASE}/franchises/admin`);
    return handleResponse<AdminFranchise[]>(res, 'Failed to fetch admin franchises');
  },

  registerFranchise: async (data: any): Promise<Franchise> => {
    const res = await fetch(`${API_BASE}/franchises/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Franchise>(res, 'Franchise registration failed');
  },

  // Auction Controls
  getAuctionState: async (): Promise<AuctionState> => {
    const res = await fetch(`${API_BASE}/auction/state`);
    return handleResponse<AuctionState>(res, 'Failed to fetch auction state');
  },

  placeBid: async (franchiseId: number, attemptedBid: number, performedBy: string = 'Franchise') => {
    const res = await fetch(`${API_BASE}/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ franchise_id: franchiseId, attempted_bid: attemptedBid, performed_by: performedBy }),
    });
    return handleResponse<any>(res, 'Bid placement failed');
  },

  passFranchise: async (franchiseId: number) => {
    const res = await fetch(`${API_BASE}/auction/pass?franchise_id=${franchiseId}`, { method: 'POST' });
    return handleResponse<any>(res, 'Failed to pass');
  },

  unpassFranchise: async (franchiseId: number) => {
    const res = await fetch(`${API_BASE}/auction/unpass?franchise_id=${franchiseId}`, { method: 'POST' });
    return handleResponse<any>(res, 'Failed to re-enter');
  },

  hammerLot: async (performedBy: string = 'Super Admin') => {
    const res = await fetch(`${API_BASE}/auction/hammer?performed_by=${encodeURIComponent(performedBy)}`, { method: 'POST' });
    return handleResponse<any>(res, 'Failed to complete lot hammer');
  },

  skipPlayer: async (performedBy: string = 'Super Admin') => {
    const res = await fetch(`${API_BASE}/auction/skip?performed_by=${encodeURIComponent(performedBy)}`, { method: 'POST' });
    return handleResponse<any>(res, 'Failed to skip player');
  },

  undoTransaction: async (auditId: number, reason: string) => {
    const res = await fetch(`${API_BASE}/auction/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: auditId, reason }),
    });
    return handleResponse<any>(res, 'Undo failed');
  },

  directAssignPlayer: async (playerId: number, franchiseId: number, price: number, reason: string) => {
    const res = await fetch(`${API_BASE}/auction/direct-assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, franchise_id: franchiseId, price, reason }),
    });
    return handleResponse<any>(res, 'Direct assign failed');
  },

  relaxMinimum: async (bucket: string, newMinimum: number, reason: string) => {
    const res = await fetch(`${API_BASE}/auction/relax-minimum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, new_minimum: newMinimum, reason }),
    });
    return handleResponse<any>(res, 'Relax minimum failed');
  },

  drawNextPlayer: async () => {
    const res = await fetch(`${API_BASE}/auction/draw-next`, { method: 'POST' });
    return handleResponse<any>(res, 'Draw next failed');
  },

  getAuditLog: async (): Promise<AuditLog[]> => {
    const res = await fetch(`${API_BASE}/audit-log`);
    return handleResponse<AuditLog[]>(res, 'Failed to fetch audit log');
  },

  exportExcelUrl: () => `${API_BASE}/export/excel`,

  lookupPlayer: async (query: string) => {
    const res = await fetch(`${API_BASE}/players/lookup?query=${encodeURIComponent(query)}`);
    return handleResponse<any>(res, 'Player lookup failed');
  },

  updateTimerConfig: async (durationSeconds?: number, action?: string) => {
    const res = await fetch(`${API_BASE}/auction/timer-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: durationSeconds, action }),
    });
    return handleResponse<any>(res, 'Timer update failed');
  },

  setActiveBucket: async (bucket: string) => {
    const res = await fetch(`${API_BASE}/auction/set-bucket?bucket=${encodeURIComponent(bucket)}`, { method: 'POST' });
    return handleResponse<any>(res, 'Set bucket failed');
  },

  selectPlayerForLot: async (playerId: number) => {
    const res = await fetch(`${API_BASE}/auction/select-player?player_id=${playerId}`, { method: 'POST' });
    return handleResponse<any>(res, 'Select player failed');
  },
};
