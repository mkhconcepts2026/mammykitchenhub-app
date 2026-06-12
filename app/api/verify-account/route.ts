import { NextResponse } from "next/server";

export async function POST(
  request: Request
) {

  try {

    const {
      accountNumber,
      bankCode
    } = await request.json();

    if (
      !accountNumber ||
      !bankCode
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "Missing account details"
        },
        {
          status: 400
        }
      );

    }

    const response =
      await fetch(

        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,

        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

            "Content-Type":
              "application/json"
          }
        }

      );

    const data =
      await response.json();

    if (
      !data.status
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            data.message
        },
        {
          status: 400
        }
      );

    }

    return NextResponse.json({

      success: true,

      accountName:
        data.data.account_name

    });

  } catch (error) {

    console.error(
      "Verify Account Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Verification failed"
      },
      {
        status: 500
      }
    );

  }

}