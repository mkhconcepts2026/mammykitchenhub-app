"use client";

type MenuForm = {
  name: string;
  description: string;
  category: string;
  image: string;
  price: string;
  available: boolean;
};

type VendorMenuTabProps = {
  menuItems: any[];
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  form: MenuForm;
  setForm: (form: MenuForm) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  saveMenuItem: () => Promise<void>;
  editMenuItem: (item: any) => void;
  deleteMenuItem: (id: string) => Promise<void>;
  toggleAvailability: (item: any) => Promise<void>;
};

export default function VendorMenuTab({
  menuItems,
  showForm,
  setShowForm,
  editingId,
  setEditingId,
  form,
  setForm,
  imageFile,
  setImageFile,
  saveMenuItem,
  editMenuItem,
  deleteMenuItem,
  toggleAvailability,
}: VendorMenuTabProps) {
  return (
  <div className="bg-white rounded-3xl p-8">

      <div className="flex justify-between items-center mb-6">

        <h2 className="text-2xl font-bold">
          Menu Management
        </h2>

        <button
          onClick={() => {
            setEditingId(null);

            setForm({
              name: "",
              description: "",
              category: "Rice",
              image: "",
              price: "",
              available: true,
            });

            setShowForm(true);
          }}
          className="
            bg-orange-500
            text-white
            px-4
            py-2
            rounded-xl
          "
        >
          Add Item
        </button>

      </div>

      {showForm && (

        <div className="
          border
          rounded-xl
          p-4
          mb-6
          space-y-3
        ">

          <input
            placeholder="Food Name"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
            className="
              w-full
              border
              p-3
              rounded-lg
            "
          />

          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
            className="
              w-full
              border
              p-3
              rounded-lg
            "
          />

          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) =>
              setForm({
                ...form,
                category: e.target.value,
              })
            }
            className="
              w-full
              border
              p-3
              rounded-lg
            "
          />

  <input
    type="file"
    accept="image/png,image/jpeg,image/jpg"
    onChange={(e)=>{

      const file =
        e.target.files?.[0];

      if(!file) return;

      if(
        file.size >
        5 * 1024 * 1024
      ){

        alert(
          "Image must be less than 5MB"
        );

        return;

      }

      setImageFile(file);

    }}
    className="
      w-full
      border
      p-3
      rounded-lg
    "
  />

          <input
            type="number"
            placeholder="Price"
            value={form.price}
            onChange={(e) =>
              setForm({
                ...form,
                price: e.target.value,
              })
            }
            className="
              w-full
              border
              p-3
              rounded-lg
            "
          />
  {imageFile && (

    <img
      src={URL.createObjectURL(imageFile)}
      alt="Preview"
      className="
        w-40
        h-40
        object-cover
        rounded-xl
      "
    />

  )}
         <button
    type="button"
    onClick={saveMenuItem}
    className="
      bg-green-600
      text-white
      px-5
      py-2
      rounded-xl
    "
  >
    {editingId
      ? "Update Item"
      : "Save Item"}
  </button>

        </div>

      )}

      <div className="space-y-3">

        {menuItems.length === 0 ? (

          <p className="text-gray-500">
            No menu items found.
          </p>

        ) : (

          menuItems.map((item) => (

    <div
      key={item.id}
      className="
        bg-white
        rounded-2xl
        shadow-sm
        border
        p-4
        flex
        justify-between
        items-center
        mb-4
      "
    >

      <div className="flex items-center gap-4">

        <img
          src={
            item.image ||
            "/placeholder.jpg"
          }
          alt={item.name}
          className="
            w-24
            h-24
            rounded-xl
            object-cover
          "
        />

        <div>

          <h3 className="
            font-bold
            text-xl
          ">
            {item.name}
          </h3>

          <p className="
            text-gray-500
          ">
            {item.category}
          </p>

          <p className="
            text-orange-600
            font-bold
            text-lg
          ">
            ₦{Number(item.price).toLocaleString()}
          </p>

        </div>

      </div>

      <div className="
        flex
        items-center
        gap-3
      ">

        <button
          onClick={() =>
            toggleAvailability(item)
          }
          className={`
            px-4
            py-2
            rounded-full
            text-sm
            font-semibold
            ${
              item.available
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }
          `}
        >
          {item.available
            ? "Available"
            : "Out Of Stock"}
        </button>

        <button
          onClick={() =>
            editMenuItem(item)
          }
          className="
            bg-blue-500
            text-white
            px-4
            py-2
            rounded-lg
          "
        >
          Edit
        </button>

        <button
          onClick={() =>
            deleteMenuItem(item.id)
          }
          className="
            bg-red-500
            text-white
            px-4
            py-2
            rounded-lg
          "
        >
          Delete
        </button>

      </div>

    </div>

  ))

        )}

      </div>

    </div>
  );
}
