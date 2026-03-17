import type { Chain } from '../context/ChainContext';

// ════════════════════════════════════════════════════════════════
// DATA MODELS — Use these as reference for your backend DB schema
// ════════════════════════════════════════════════════════════════

/**
 * Savings configuration per chain.
 * 
 * Backend DB model suggestion:
 *   Table: savings_config
 *   - id           SERIAL PRIMARY KEY
 *   - user_id      INT NOT NULL REFERENCES users(id)
 *   - chain        VARCHAR(10) NOT NULL  (SUI | SOLANA | APTOS | BSC | BASE | TRON)
 *   - enabled      BOOLEAN DEFAULT false
 *   - percentage   DECIMAL(5,2) NOT NULL DEFAULT 5.00  (1.00 – 50.00)
 *   - savings_address VARCHAR(128) NOT NULL
 *   - created_at   TIMESTAMP DEFAULT NOW()
 *   - updated_at   TIMESTAMP DEFAULT NOW()
 *   UNIQUE(user_id, chain)
 */
export interface SavingsConfig {
    enabled: boolean;
    percentage: number;       // 1–50
    savingsAddress: string;   // user-provided wallet address
}

/**
 * Individual savings entry logged after each auto-save.
 *
 * Backend DB model suggestion:
 *   Table: savings_entries
 *   - id             SERIAL PRIMARY KEY
 *   - user_id        INT NOT NULL REFERENCES users(id)
 *   - chain          VARCHAR(10) NOT NULL
 *   - amount         DECIMAL(20,6) NOT NULL   (USDC amount saved)
 *   - savings_address VARCHAR(128) NOT NULL
 *   - source_tx_hash VARCHAR(128)             (hash of the original transaction)
 *   - savings_tx_hash VARCHAR(128)            (hash of the savings transfer)
 *   - order_id       VARCHAR(64)              (related order ID if applicable)
 *   - status         VARCHAR(20) DEFAULT 'completed' (completed | failed | pending)
 *   - created_at     TIMESTAMP DEFAULT NOW()
 *   INDEX(user_id, chain)
 *   INDEX(user_id, created_at)
 */
export interface SavingsEntry {
    id: string;
    chain: Chain;
    amount: number;          // USDC amount
    savingsAddress: string;
    sourceTxHash?: string;   // hash of the main payment tx
    savingsTxHash?: string;  // hash of the savings transfer tx
    orderId?: string;
    status: 'completed' | 'failed' | 'pending' | 'no deposit found';
    createdAt: string;       // ISO date string
}

// ════════════════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS (will be replaced by API calls later)
// ════════════════════════════════════════════════════════════════

const CONFIG_KEY = (chain: Chain) => `linq_savings_config_${chain}`;
const HISTORY_KEY = (chain: Chain) => `linq_savings_history_${chain}`;

const DEFAULT_CONFIG: SavingsConfig = {
    enabled: false,
    percentage: 5,
    savingsAddress: '',
};

export function getSavingsConfig(chain: Chain): SavingsConfig {
    try {
        const raw = localStorage.getItem(CONFIG_KEY(chain));
        if (!raw) return { ...DEFAULT_CONFIG };
        return JSON.parse(raw);
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

export function setSavingsConfig(chain: Chain, config: SavingsConfig): void {
    localStorage.setItem(CONFIG_KEY(chain), JSON.stringify(config));
}

export function getSavingsHistory(chain: Chain): SavingsEntry[] {
    try {
        const raw = localStorage.getItem(HISTORY_KEY(chain));
        if (!raw) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function addSavingsEntry(chain: Chain, entry: SavingsEntry): void {
    const history = getSavingsHistory(chain);
    history.unshift(entry); // newest first
    // Keep last 200 entries per chain in localStorage
    localStorage.setItem(HISTORY_KEY(chain), JSON.stringify(history.slice(0, 200)));
}

export function getTotalSaved(chain: Chain): number {
    const history = getSavingsHistory(chain);
    return history
        .filter(e => e.status === 'completed')
        .reduce((sum, e) => sum + e.amount, 0);
}

export function generateEntryId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
