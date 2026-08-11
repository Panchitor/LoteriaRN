import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { activationCode, agencyNumber, subagencyNumber, tvNumber, installationId } = await req.json();

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

      const claimed = await prisma.$transaction(async (tx) => {
        const consumed = await tx.deviceActivationCode.updateMany({
          where: { id: activation.id, used_at: null, expires_at: { gt: new Date() } },
          data: { used_at: new Date() },
        });
        if (consumed.count !== 1) throw new Error("ACTIVATION_ALREADY_USED");
        return tx.device.update({
          where: { id: activation.device_id },
          data: { installation_id: String(installationId), revoked_at: null, status: "online" },
          include: { agency: true },
        });
      });

      return NextResponse.json({
        success: true,
        token: claimed.id,
        agency_name: claimed.agency.city || `Agencia ${claimed.agency.number}`,
      });
    }

    // Compatibilidad temporal con instalaciones anteriores a la vinculación por código.
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
      return NextResponse.json({ error: "Número de agencia no registrado en la central." }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
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

    // Return the device ID as the secure token
    return NextResponse.json({
      success: true,
      token: device.id,
      agency_name: agency.name || `Agencia ${agency.number}`
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (err: any) {
    console.error("Register Error:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
