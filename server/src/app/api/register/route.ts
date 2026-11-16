import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorCode, errorMessage } from "@/lib/errors";
import { createDeviceToken } from "@/lib/deviceToken";
import { clientAddress, enforceRateLimit, readJsonBody, requestErrorResponse } from "@/lib/requestGuards";

type RegisterBody = {
  activationCode?: unknown; agencyNumber?: unknown; subagencyNumber?: unknown;
  tvNumber?: unknown; installationId?: unknown; assetLabel?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, "register", clientAddress(req), 20, 10 * 60 * 1000);
    if (limited) return limited;
    const body = await readJsonBody<RegisterBody>(req, 16 * 1024);
    const activationCode = body.activationCode == null ? "" : String(body.activationCode);
    const agencyNumber = body.agencyNumber == null ? "" : String(body.agencyNumber);
    const subagencyNumber = body.subagencyNumber == null ? "" : String(body.subagencyNumber);
    const tvNumber = body.tvNumber == null ? "" : String(body.tvNumber);
    const installationId = body.installationId == null ? "" : String(body.installationId);
    const assetLabel = body.assetLabel;
    const label = assetLabel == null ? undefined : String(assetLabel).trim().toUpperCase();
    if (label !== undefined && !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(label)) {
      return NextResponse.json({ error: "El ID de etiqueta debe tener entre 3 y 40 letras, números, guiones o guiones bajos." }, { status: 400 });
    }

    if (!installationId) {
      return NextResponse.json({ error: "Falta la identificación del dispositivo." }, { status: 400 });
    }

    if (activationCode) {
      const normalizedCode = String(activationCode).replace(/\D/g, "");
      const activation = await prisma.deviceActivationCode.findUnique({
        where: { code: normalizedCode },
        include: { device: { include: { agency: true } } },
      });

      if (!activation || activation.used_at || activation.expires_at <= new Date() || activation.attempts >= 10) {
        if (activation && !activation.used_at) {
          await prisma.deviceActivationCode.update({ where: { id: activation.id }, data: { attempts: { increment: 1 } } });
        }
        return NextResponse.json({ error: "Código inválido, vencido o ya utilizado." }, { status: 403 });
      }
      if (activation.device.installation_id && activation.device.installation_id !== String(installationId)) {
        return NextResponse.json({ error: "El dispositivo reservado no está disponible." }, { status: 403 });
      }

      const credential = createDeviceToken(activation.device_id);
      const claimed = await prisma.$transaction(async (tx) => {
        const consumed = await tx.deviceActivationCode.updateMany({
          where: { id: activation.id, used_at: null, expires_at: { gt: new Date() } },
          data: { used_at: new Date() },
        });
        if (consumed.count !== 1) throw new Error("ACTIVATION_ALREADY_USED");
        return tx.device.update({
          where: { id: activation.device_id },
          data: { installation_id: String(installationId), api_token_hash: credential.hash, revoked_at: null, status: "online", asset_label: label },
          include: { agency: true },
        });
      });

      return NextResponse.json({
        success: true,
        token: credential.token,
        agency_name: claimed.agency.city || `Agencia ${claimed.agency.number}`,
      });
    }

    // Compatibilidad temporal con instalaciones anteriores a la vinculación por código.
    const legacyRegistrationAllowed = process.env.NODE_ENV !== "production"
      || process.env.ALLOW_LEGACY_DEVICE_REGISTRATION === "true";
    if (!legacyRegistrationAllowed) {
      return NextResponse.json({ error: "El registro por agencia fue reemplazado por códigos de activación." }, { status: 410 });
    }
    if (!agencyNumber) {
      return NextResponse.json({ error: "Falta el código de vinculación." }, { status: 400 });
    }

    const numberParsed = parseInt(agencyNumber, 10);
    const subagencyParsed = subagencyNumber ? parseInt(subagencyNumber, 10) : null;
    const agencyCode = subagencyParsed ? `${numberParsed}-${subagencyParsed}` : `${numberParsed}`;
    
    // Check if the agency exists
    const agency = await prisma.agency.findUnique({
      where: { code: agencyCode }
    });

    if (!agency) {
      return NextResponse.json({ error: "Número de agencia no registrado en la central." }, { status: 403 });
    }

    // Provision a Device specifically for this agency or reuse the first existing one
    let device = await prisma.device.findUnique({
      where: { installation_id: String(installationId) }
    });

    if (device && (device.agency_id !== agency.id || device.revoked_at)) {
      return NextResponse.json({ error: "El dispositivo no está autorizado para esta agencia." }, { status: 403 });
    }

    if (!device) {
      const tvNumberParsed = tvNumber ? parseInt(tvNumber, 10) : null;
      const reservedDevice = tvNumberParsed
        ? await prisma.device.findFirst({ where: { agency_id: agency.id, tv_number: tvNumberParsed, installation_id: null } })
        : null;
      device = reservedDevice
        ? await prisma.device.update({ where: { id: reservedDevice.id }, data: { installation_id: String(installationId), status: "online" } })
        : await prisma.device.create({
            data: { agency_id: agency.id, installation_id: String(installationId), tv_number: tvNumberParsed, status: "online" }
          });
    }

    const credential = createDeviceToken(device.id);
    await prisma.device.update({
      where: { id: device.id },
      data: { api_token_hash: credential.hash },
    });

    // Return the device ID as the secure token
    return NextResponse.json({
      success: true,
      token: credential.token,
      agency_name: agency.name || `Agencia ${agency.number}`
    });

  } catch (error: unknown) {
    const requestError = requestErrorResponse(error);
    if (requestError) return requestError;
    if (errorCode(error) === 'P2002') return NextResponse.json({ error: "Ese ID de etiqueta o instalación ya está asignado a otro dispositivo. Revise el registro antes de vincular." }, { status: 409 });
    console.error("Register Error:", errorMessage(error));
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
