import { NextResponse } from "next/server";

import { createEmployee } from "@/lib/employees/createEmployee";

export async function POST(request: Request) {

  try {

    const body = await request.json();

    const result =
      await createEmployee(body);

    return NextResponse.json(result);

  }

  catch (error: any) {

    console.error(error);

    return NextResponse.json(

      {

        success: false,

        message:
          error.message ||

          "Unable to create employee.",

      },

      {

        status: 400,

      }

    );

  }

}