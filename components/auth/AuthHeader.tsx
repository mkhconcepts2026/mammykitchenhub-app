"use client";

type Props = {

  title: string;

  subtitle: string;

};

export default function AuthHeader({

  title,

  subtitle,

}: Props) {

  return (

    <div className="mb-10">

      <div
        className="
          flex
          items-center
          gap-4
          mb-4
        "
      >

        <div
          className="
            h-[2px]
            w-10
            bg-orange-500
          "
        />

        <span
          className="
            uppercase
            text-sm
            tracking-[0.2em]
            text-orange-600
            font-bold
          "
        >

          CUSTOMER ACCOUNT

        </span>

      </div>

    <h1
  className="
    text-5xl
    font-black
    leading-none
    text-gray-900
    mb-4
  "
>
  Welcome to MKH
  <span className="ml-2 inline-block align-middle text-5xl">
    👋
  </span>
</h1>

      <p
        className="
          text-xl
          leading-9
          text-gray-500
        "
      >

        {subtitle}

      </p>

    </div>

  );

}