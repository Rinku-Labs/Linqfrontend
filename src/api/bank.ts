import client from './client';

export interface VerifyBankResponse {
    accountName: string;
    bankName: string;
}

export interface VerifyBankError {
    message: string;
    code?: string;
    success?: boolean;
}

/**
 * Verifies a bank account number with the given bank code.
 * @param accountNumber The 10-digit account number.
 * @param bankCode The code of the bank.
 * @returns The account name and bank name on success.
 */
export const verifyBankAccount = async (accountNumber: string, bankCode: string): Promise<VerifyBankResponse> => {
    try {
        const response = await client.get<VerifyBankResponse>(`/verifybank`, {
            params: {
                bankCode,
                accountNumber
            }
        });
        return response.data;
    } catch (error: any) {
        if (error.response && error.response.data) {
            throw error.response.data as VerifyBankError;
        }
        throw { message: 'Failed to verify bank account' } as VerifyBankError;
    }
};
