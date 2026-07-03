"use client";

type Props = {

  value: string;

  onChange: (
    value: string
  ) => void;

};

export default function PhoneField({

  value,

  onChange,

}: Props) {

  return (

    <div className="space-y-2">

      <label
        className="
          block
          text-sm
          font-semibold
          text-gray-700
        "
      >

        Phone Number

      </label>

      <div
        className="
          flex
          rounded-2xl
          border
          border-gray-300
          overflow-hidden
          focus-within:border-orange-500
          focus-within:ring-2
          focus-within:ring-orange-200
        "
      >

       <div
  className="
    flex
    items-center
    gap-3
    px-4
    bg-gray-100
    font-semibold
  "
>

  📞

  <span>

    +234

  </span>

</div>

        <input

          type="tel"

          value={value}

          onChange={(e)=>

            onChange(

              e.target.value.replace(

                /\D/g,

                ""

              )

            )

          }

          placeholder="8012345678"

          className="
            flex-1
            px-4
            py-4
            outline-none
          "

        />

      </div>

    </div>

  );

}