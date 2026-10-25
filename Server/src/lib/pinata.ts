type PinataIpfsResponse = {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
};

type CreateTokenMetadataUriParams = {
  name: string;
  symbol: string;
  description?: string;
  imagePath?: string;
  imageUrl?: string;
  metadataName?: string;
};

const PINATA_API_URL = "https://api.pinata.cloud/pinning";
const DEFAULT_PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

function getPinataJwt() {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    throw new Error("Missing PINATA_JWT in Server/.env");
  }

  return jwt;
}

export function getIpfsGatewayUrl(cid: string) {
  const gateway = (
    process.env.PINATA_GATEWAY ?? DEFAULT_PINATA_GATEWAY
  ).replace(/\/$/, "");

  if (gateway.endsWith("/ipfs")) {
    return gateway + "/" + cid;
  }

  return gateway + "/ipfs/" + cid;
}

async function parsePinataResponse(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Pinata upload failed (${response.status}): ${text}`);
  }

  return JSON.parse(text) as PinataIpfsResponse;
}

export async function uploadFileToPinata(filePath: string, name?: string) {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    throw new Error(`Pinata file not found: ${filePath}`);
  }

  const formData = new FormData();
  const fileName = name ?? filePath.split("/").at(-1) ?? "token-image";

  formData.append("file", file, fileName);
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: fileName,
    }),
  );

  const response = await fetch(PINATA_API_URL + "/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + getPinataJwt(),
    },
    body: formData,
  });

  const result = await parsePinataResponse(response);

  return {
    cid: result.IpfsHash,
    uri: getIpfsGatewayUrl(result.IpfsHash),
  };
}

export async function uploadJsonToPinata(
  content: Record<string, unknown>,
  name: string,
) {
  const response = await fetch(PINATA_API_URL + "/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + getPinataJwt(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataMetadata: {
        name,
      },
      pinataContent: content,
    }),
  });

  const result = await parsePinataResponse(response);

  return {
    cid: result.IpfsHash,
    uri: getIpfsGatewayUrl(result.IpfsHash),
  };
}

export async function createTokenMetadataUri({
  name,
  symbol,
  description,
  imagePath,
  imageUrl,
  metadataName,
}: CreateTokenMetadataUriParams) {
  let finalImageUrl = imageUrl;

  if (imagePath) {
    const imageUpload = await uploadFileToPinata(
      imagePath,
      symbol.toLowerCase() + "-image",
    );

    finalImageUrl = imageUpload.uri;
  }

  if (!finalImageUrl) {
    throw new Error(
      "Missing token image. Provide TEST_TOKEN_IMAGE_PATH or TEST_TOKEN_IMAGE_URL.",
    );
  }

  const metadata = {
    name,
    symbol,
    description: description ?? name + " token",
    image: finalImageUrl,
  };

  const metadataUpload = await uploadJsonToPinata(
    metadata,
    metadataName ?? symbol.toLowerCase() + "-metadata.json",
  );

  return {
    imageUri: finalImageUrl,
    metadata,
    metadataCid: metadataUpload.cid,
    metadataUri: metadataUpload.uri,
  };
}
