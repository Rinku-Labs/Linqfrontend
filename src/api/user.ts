import client from './client';

export interface UpdateBankDetailsPayload {
    username?: string;
    bankName?: string;
    bankCode: string;
    bankAccount: string;
}

export interface UpdateBankDetailsResponse {
    message: string;
    data: {
        username: string;
        accountName: string;
        bankName: string;
        bankAccount: string;
    };
}

/**
 * Updates the user's bank details and username.
 * @param details The bank details and username to update.
 */
export const updateBankDetails = async (details: UpdateBankDetailsPayload): Promise<UpdateBankDetailsResponse> => {
    const response = await client.post<UpdateBankDetailsResponse>('/user/bank-details', details);
    return response.data;
};

export interface CheckUsernameResponse {
    message: string;
    data: {
        accountName: string;
    };
}

/**
 * Checks if a username exists and returns the associated account name.
 * @param username The username to check.
 */
export const checkUsername = async (username: string): Promise<CheckUsernameResponse> => {
    const response = await client.post<CheckUsernameResponse>('/user/check-username', { username });
    return response.data;
};

// ========== Beneficiaries API ==========

export interface BeneficiaryData {
    id: number;
    bankName: string;
    bankCode: string;
    bankAccount: string;
    accountName: string;
}

export interface AddBeneficiaryPayload {
    bankName: string;
    bankCode: string;
    bankAccount: string;
    accountName: string;
}

export interface BeneficiaryResponse {
    message: string;
    data: BeneficiaryData;
}

export interface BeneficiariesListResponse {
    message: string;
    data: BeneficiaryData[];
}

export interface DeleteBeneficiaryResponse {
    message: string;
}

/** Add a new beneficiary for the authenticated user. */
export const addBeneficiary = async (payload: AddBeneficiaryPayload): Promise<BeneficiaryResponse> => {
    const response = await client.post<BeneficiaryResponse>('/user/beneficiaries', payload);
    return response.data;
};

/** Get all beneficiaries for the authenticated user. */
export const getBeneficiaries = async (): Promise<BeneficiariesListResponse> => {
    const response = await client.get<BeneficiariesListResponse>('/user/beneficiaries');
    return response.data;
};

/** Delete a beneficiary by ID. */
export const deleteBeneficiary = async (id: number): Promise<DeleteBeneficiaryResponse> => {
    const response = await client.delete<DeleteBeneficiaryResponse>(`/user/beneficiaries/${id}`);
    return response.data;
};
