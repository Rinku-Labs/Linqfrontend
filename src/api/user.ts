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

export interface GetBankDetailsResponse {
    message: string;
    data: {
        username: string;
        accountName: string;
        bankName: string;
        bankCode: string;
        bankAccount: string;
    };
}

/**
 * Updates the user's bank details and username.
 * @param details The bank details and username to update.
 */
export const updateBankDetails = async (details: {
    username: string;
    bankName?: string;
    bankCode: string;
    bankAccount: string;
    otp?: string;
}) => {
    const response = await client.post<UpdateBankDetailsResponse>('/user/bank-details', details);
    return response.data;
};

export const getBankDetails = async () => {
    const response = await client.get<GetBankDetailsResponse>('/user/bank-details');
    return response.data;
};

export const requestBankDetailsOtp = async () => {
    const response = await client.post<{ message: string }>('/user/bank-details/otp');
    return response.data;
};

export interface CheckUsernameResponse {
    message: string;
    data: {
        accountName: string;
        bankName: string;
        bankCode: string;
        bankAccount: string;
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

// --- Bill Beneficiaries ---

export interface BillBeneficiary {
    id: number;
    billType: string;
    network: string;
    customerId: string;
    customerLabel: string;
    itemCode?: string;
    billerCode?: string;
    itemName?: string;
    amountNgn?: number;
    CreatedAt?: string;
    UpdatedAt?: string;
}

export interface AddBillBeneficiaryPayload {
    billType: string;
    network: string;
    customerId: string;
    customerLabel: string;
    itemCode?: string;
    billerCode?: string;
    itemName?: string;
    amountNgn?: number;
}

export interface BillBeneficiaryResponse {
    message: string;
    data: BillBeneficiary;
}

export interface BillBeneficiariesListResponse {
    message: string;
    data: BillBeneficiary[];
}

export const addBillBeneficiary = async (payload: AddBillBeneficiaryPayload): Promise<BillBeneficiaryResponse> => {
    const response = await client.post<BillBeneficiaryResponse>('/user/bill-beneficiaries', payload);
    return response.data;
};

export const getBillBeneficiaries = async (): Promise<BillBeneficiariesListResponse> => {
    const response = await client.get<BillBeneficiariesListResponse>('/user/bill-beneficiaries');
    return response.data;
};

export const deleteBillBeneficiary = async (id: number): Promise<DeleteBeneficiaryResponse> => {
    const response = await client.delete<DeleteBeneficiaryResponse>(`/user/bill-beneficiaries/${id}`);
    return response.data;
};

