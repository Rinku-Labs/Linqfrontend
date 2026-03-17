import client from './client';

export interface VerificationLinkResponse {
    link: string;
    ref_id: string;
}

export interface VerificationStatusResponse {
    verified: boolean;
    verification_status: boolean;
}

export interface VerifyNINResponse {
    job_id: string;
    masked_phone: string;
    message: string;
    status: string;
}

export interface ResendOTPResponse {
    job_id: string;
    masked_phone: string;
    message: string;
    status: string;
}

export interface VerifyOTPResponse {
    verified: boolean;
    message: string;
}

export const getVerificationLink = async (userId: string): Promise<VerificationLinkResponse> => {
    const response = await client.post('/kyc/link', { user_id: userId });
    return response.data;
};

export const verifyNIN = async (nin: string, userId: string): Promise<VerifyNINResponse> => {
    const response = await client.post('/kyc/verify-nin', { nin, user_id: userId });
    return response.data;
};

export const verifyOTP = async (user_id: string, otp: string, job_id: string): Promise<VerifyOTPResponse> => {
    const response = await client.post('/kyc/verify-otp', { user_id, otp, job_id });
    return response.data;
};

export const resendOTP = async (userId: string): Promise<ResendOTPResponse> => {
    const response = await client.post('/kyc/resend-otp', { user_id: userId });
    return response.data;
};

export const getVerificationStatus = async (): Promise<VerificationStatusResponse> => {
    const response = await client.get('/user/verification-status');
    return response.data;
};
