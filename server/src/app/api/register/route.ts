import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { agencyNumber } = await req.json();

    if (!agencyNumber) {
      return NextResponse.json({ error: "Falta el número de agencia." }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const numberParsed = parseInt(agencyNumber, 10);
    
    // Check if the agency exists
    const agency = await prisma.agency.findUnique({
      where: { number: numberParsed }
    });

    if (!agency) {
      return NextResponse.json({ error: "Número de agencia no registrado en la central." }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Provision a Device specifically for this agency or reuse the first existing one
    let device = await prisma.device.findFirst({
      where: { agency_id: agency.id }
    });

    if (!device) {
      device = await prisma.device.create({
        data: {
          agency_id: agency.id,
          status: "online",
        }
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
