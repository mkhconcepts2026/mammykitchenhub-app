"use client";

type VendorKYCTabProps = {
  kycStatus: string;
  cacFile: File | null;
  setCacFile: (file: File | null) => void;
  idFile: File | null;
  setIdFile: (file: File | null) => void;
  selfieFile: File | null;
  setSelfieFile: (file: File | null) => void;
  selectedBank: string;
  setSelectedBank: (bank: string) => void;
  accountNumber: string;
  setAccountNumber: (accountNumber: string) => void;
  verifiedAccountName: string;
  verifyingAccount: boolean;
  submittingKyc: boolean;
  onVerifyAccount: () => Promise<void>;
  submitKyc: () => Promise<void>;
};

export default function VendorKYCTab({
  kycStatus,
  cacFile,
  setCacFile,
  idFile,
  setIdFile,
  selfieFile,
  setSelfieFile,
  selectedBank,
  setSelectedBank,
  accountNumber,
  setAccountNumber,
  verifiedAccountName,
  verifyingAccount,
  submittingKyc,
  onVerifyAccount,
  submitKyc,
}: VendorKYCTabProps) {
  return (
    <div className="space-y-6">

        <div>

          <h1 className="text-5xl font-bold">
            KYC Verification
          </h1>
    {
      kycStatus !== "Not Submitted" && (

        <div
          className="
            bg-yellow-50
            border
            border-yellow-300
            rounded-2xl
            p-6
            mb-6
          "
        >

          <h3 className="font-bold text-xl">

            KYC Status

          </h3>

          <p className="mt-2 text-lg">

            {kycStatus}

          </p>

        </div>

      )
    }
          <p className="text-gray-500 text-lg">
            Complete your business verification
          </p>

        </div>

    {kycStatus === "Not Submitted" && (
        <div className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
        ">

          <div className="
            flex
            justify-between
            items-center
            mb-6
          ">

            <h2 className="
              text-2xl
              font-bold
            ">
              Verification Status
            </h2>

            <span
              className="
                bg-yellow-100
                text-yellow-700
                px-4
                py-2
                rounded-full
                font-semibold
              "
            >
              {kycStatus}
            </span>

          </div>
        
          <div className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-6
          ">

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">
                CAC Certificate
              </label>

              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e)=>
                  setCacFile(
                    e.target.files?.[0] || null
                  )
                }
                className="
                  w-full
                  border
                  p-3
                  rounded-xl
                "
              />

            </div>

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">
                National ID
              </label>

              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e)=>
                  setIdFile(
                    e.target.files?.[0] || null
                  )
                }
                className="
                  w-full
                  border
                  p-3
                  rounded-xl
                "
              />

            </div>

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">
                Selfie Verification
              </label>

              <input
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={(e)=>
                  setSelfieFile(
                    e.target.files?.[0] || null
                  )
                }
                className="
                  w-full
                  border
                  p-3
                  rounded-xl
                "
              />

            </div>

             </div>

        </div>

    )}

        <div className="
          bg-white
          rounded-3xl
          p-6
          shadow-sm
        ">

       {kycStatus === "Not Submitted" && (

    <div>

      <h2 className="
        text-2xl
        font-bold
        mb-6
      ">
        Bank Account Details
      </h2>

          <div className="
            grid
            grid-cols-1
            md:grid-cols-3
            gap-4
          ">

        <select
      value={selectedBank}
      onChange={(e)=>
        setSelectedBank(
          e.target.value
        )
      }
      className="
        border
        p-4
        rounded-xl
      "
    >

      <option value="">
      Select Bank
    </option>

    <option value="044">
      Access Bank
    </option>

    <option value="058">
      GTBank
    </option>

    <option value="011">
      First Bank
    </option>

    <option value="033">
      UBA
    </option>

    <option value="057">
      Zenith Bank
    </option>

    <option value="070">
      Fidelity Bank
    </option>

    <option value="999992">
      Opay
    </option>

    <option value="50515">
      Moniepoint
    </option>

    <option value="999991">
      PalmPay
    </option>

    </select>

    <input
      placeholder="Account Number"
      value={accountNumber}
      onChange={(e)=>
        setAccountNumber(
          e.target.value
        )
      }
      className="
        border
        p-4
        rounded-xl
      "
    />

    <div
      className="
        border
        p-4
        rounded-xl
        bg-gray-50
      "
    >

      {verifiedAccountName || "Account name will appear here"}

    </div>

          </div>

    <button
      type="button"
       onClick={onVerifyAccount}
      className="
        mt-4
        bg-blue-600
        text-white
        px-6
        py-3
        rounded-xl
        font-semibold
      "
    >

      {
        verifyingAccount
          ? "Verifying..."
          : "Verify Account"
      }

    </button>

         <button
      onClick={submitKyc}
      disabled={submittingKyc}
      className="
        mt-6
        bg-orange-500
        text-white
        px-6
        py-3
        rounded-xl
        font-semibold
        disabled:opacity-50
        disabled:cursor-not-allowed
      "
    >

      {
        submittingKyc
          ? "Submitting..."
          : "Submit Verification"
      }


    </button>

    </div>

    )}

    </div>

    </div>
  );
}
