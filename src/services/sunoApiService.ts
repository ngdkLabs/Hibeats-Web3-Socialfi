/**
 * Suno API Service
 * Handles file upload, vocal separation, and cover generation
 */

const SUNO_API_BASE = "https://api.sunoapi.org";
const FILE_UPLOAD_API = "https://sunoapiorg.redpandaai.co";

interface FileUploadResponse {
  success: boolean;
  code: number;
  msg: string;
  data?: {
    fileName: string;
    filePath: string;
    downloadUrl: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  };
}

interface VocalSeparationRequest {
  taskId: string;
  audioId: string;
  type: "separate_vocal" | "split_stem";
  callBackUrl: string;
}

interface VocalSeparationResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface SeparationStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    musicId: string;
    callbackUrl: string;
    audioId: string;
    completeTime: string;
    response: {
      originUrl: string | null;
      instrumentalUrl: string | null;
      vocalUrl: string | null;
      backingVocalsUrl: string | null;
      drumsUrl: string | null;
      bassUrl: string | null;
      guitarUrl: string | null;
      keyboardUrl: string | null;
      percussionUrl: string | null;
      stringsUrl: string | null;
      synthUrl: string | null;
      fxUrl: string | null;
      brassUrl: string | null;
      woodwindsUrl: string | null;
    };
    successFlag: "PENDING" | "SUCCESS" | "CREATE_TASK_FAILED" | "GENERATE_AUDIO_FAILED" | "CALLBACK_EXCEPTION";
    createTime: string;
    errorCode: number | null;
    errorMessage: string | null;
  };
}

interface CoverGenerationRequest {
  taskId: string;
  callBackUrl: string;
}

interface UploadAndCoverRequest {
  uploadUrl: string;
  prompt?: string;
  style?: string;
  title?: string;
  customMode: boolean;
  instrumental: boolean;
  personaId?: string;
  model: "V3_5" | "V4" | "V4_5" | "V4_5PLUS" | "V5";
  negativeTags?: string;
  vocalGender?: "m" | "f";
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  callBackUrl: string;
}

export type { UploadAndCoverRequest };

interface UploadAndCoverResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface CoverGenerationResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface CoverStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    parentTaskId: string;
    callbackUrl: string;
    completeTime: string;
    response: {
      images: string[];
    };
    successFlag: 0 | 1 | 2 | 3; // 0-Pending, 1-Success, 2-Generating, 3-Failed
    createTime: string;
    errorCode: number;
    errorMessage: string;
  };
}

class SunoApiService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_SUNO_API_KEY || "";
  }

  private getHeaders() {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Upload file to Suno file stream API
   */
  async uploadFile(file: File, uploadPath: string = "music/covers"): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploadPath", uploadPath);
    formData.append("fileName", `${Date.now()}_${file.name}`);

    const response = await fetch(`${FILE_UPLOAD_API}/api/file-stream-upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Separate vocals from music
   */
  async separateVocals(request: VocalSeparationRequest): Promise<VocalSeparationResponse> {
    const response = await fetch(`${SUNO_API_BASE}/api/v1/vocal-removal/generate`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    const data = await response.json();
    
    if (!response.ok || data.code !== 200) {
      throw new Error(data.msg || `Separation failed: ${response.statusText}`);
    }

    return data;
  }

  /**
   * Get vocal separation status
   */
  async getSeparationStatus(taskId: string): Promise<SeparationStatusResponse> {
    const response = await fetch(
      `${SUNO_API_BASE}/api/v1/vocal-removal/record-info?taskId=${taskId}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate cover for music
   */
  async generateCover(request: Omit<CoverGenerationRequest, 'audioId'>): Promise<CoverGenerationResponse> {
    const response = await fetch(`${SUNO_API_BASE}/api/v1/suno/cover/generate`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    const data = await response.json();
    
    if (!response.ok || data.code !== 200) {
      throw new Error(data.msg || `Cover generation failed: ${response.statusText}`);
    }

    return data;
  }

  /**
   * Get cover generation status
   */
  async getCoverStatus(taskId: string): Promise<CoverStatusResponse> {
    const response = await fetch(
      `${SUNO_API_BASE}/api/v1/suno/cover/record-info?taskId=${taskId}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get cover status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Upload and cover audio - Generate a cover version of uploaded audio
   */
  async uploadAndCover(request: UploadAndCoverRequest): Promise<UploadAndCoverResponse> {
    const response = await fetch(`${SUNO_API_BASE}/api/v1/generate/upload-cover`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    const data = await response.json();
    
    if (!response.ok || data.code !== 200) {
      throw new Error(data.msg || `Upload and cover failed: ${response.statusText}`);
    }

    return data;
  }
}

export const sunoApiService = new SunoApiService();
