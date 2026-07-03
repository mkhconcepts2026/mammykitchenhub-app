type Props = {

  title: string;

};

export default function PlaceholderPage({

  title

}: Props) {

  return (

    <div className="flex min-h-screen items-center justify-center bg-gray-50">

      <div className="text-center">

        <h1 className="text-4xl font-bold text-slate-800">

          {title}

        </h1>

        <p className="mt-4 text-gray-500">

          This page is under development.

        </p>

      </div>

    </div>

  );

}