import React from 'react'

function NetworkImage(props) {
  let { network, assetlist, width, height, alt } = props
  height = height || 30
  width = width || 30
  let fallbackImage = `https://craftypixels.com/placeholder-image/${width}x${height}/ffffff/a6a6a6&text=missing`
  let image

  if(assetlist){
    const baseAsset = assetlist.assets && assetlist.assets[0];
    image = baseAsset?.logo_URIs?.svg || baseAsset?.logo_URIs?.png
  }

  image = image || network.image

  return (
    <img src={image || fallbackImage} width={width} height={height} alt={alt} className={`rounded-circle ${props.className}`} onError={({ currentTarget }) => {
      currentTarget.onerror = null; // prevents looping
      currentTarget.src = fallbackImage;
    }} />
  )
}

export default NetworkImage