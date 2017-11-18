import React from "react";
import { connect } from "react-redux";
import { FILE_INFO } from "../../actionTypes";
import PlaylistMenu from "./PlaylistMenu";

/* eslint-disable no-alert */

const MiscMenu = () => (
  <PlaylistMenu id="playlist-misc-menu">
    <div
      className="sort-list"
      onClick={() => alert("Not supported in Winamp2-js")}
    />
    {/* onClick={props.fileInfo} */}
    <div
      className="file-info"
      onClick={() => alert("Not supported in Winamp2-js")}
    />
    <div
      className="misc-options"
      onClick={() => alert("Not supported in Winamp2-js")}
    />
  </PlaylistMenu>
);

const mapDispatchToProps = {
  fileInfo: () => ({ type: FILE_INFO })
};
export default connect(null, mapDispatchToProps)(MiscMenu);
