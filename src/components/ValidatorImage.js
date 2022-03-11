function ValidatorImage(props) {
  const className = props.className || "";
  return (
    <>
      {props.imageUrl ? (
        <img
          className={`rounded-circle border border-light ${className}`}
          width={props.width || 40}
          height={props.height || 40}
          src={props.imageUrl}
        />
      ) : (
        <div
          className={`btn-circle btn-circle-sm text-center bg-light rounded-circle border border-light ${className}`}
        >
          <i className="bi bi-person-lines-fill" />
        </div>
      )}
    </>
  );
}

export default ValidatorImage;
